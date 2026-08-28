import { createFileRoute } from "@tanstack/react-router";

/**
 * Canva OAuth redirect target. Public by necessity (the provider calls it with
 * no app session), so it authorizes the caller itself: the only trusted input is
 * the opaque, single-use, short-lived `state` value minted by
 * `beginCanvaAuthorization`. The state row identifies the user — nothing about
 * the user is ever read from the query string.
 *
 * Never renders tokens or secrets; always finishes as a redirect back into the
 * dashboard with a coarse status flag.
 */

const DASHBOARD_PATH = "/dashboard/integrations";

function backTo(request: Request, params: Record<string, string>): Response {
  const url = new URL(DASHBOARD_PATH, new URL(request.url).origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

export const Route = createFileRoute("/api/public/integrations/canva/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code") ?? "";
        const providerError = url.searchParams.get("error");

        if (!state || state.length < 16) {
          return backTo(request, { canva: "error", reason: "invalid_state" });
        }

        const {
          integrationAdminClient,
          consumeCanvaState,
          exchangeCanvaCode,
          storeCanvaConnection,
          markCanvaError,
        } = await import("@/lib/canva-oauth.server");

        let supabase;
        try {
          supabase = integrationAdminClient();
        } catch {
          return backTo(request, { canva: "error", reason: "server_config" });
        }

        let pending;
        try {
          pending = await consumeCanvaState(supabase, state);
        } catch (err) {
          const reason = err instanceof Error ? err.message : "invalid_state";
          return backTo(request, {
            canva: "error",
            reason: reason === "expired_state" ? "expired_state" : "invalid_state",
          });
        }

        if (providerError || !code) {
          await markCanvaError(supabase, pending.row.id, providerError ?? "missing_code");
          return backTo(request, { canva: "denied" });
        }

        try {
          const tokens = await exchangeCanvaCode({
            code,
            codeVerifier: pending.codeVerifier,
          });
          if (!tokens.access_token) throw new Error("no_access_token");
          await storeCanvaConnection(supabase, { rowId: pending.row.id, tokens });
        } catch (err) {
          console.error("[canva] token exchange failed", {
            connection_id: pending.row.id,
            message: err instanceof Error ? err.message : "unknown",
          });
          await markCanvaError(supabase, pending.row.id, "token_exchange_failed");
          return backTo(request, { canva: "error", reason: "exchange_failed" });
        }

        return backTo(request, { canva: "connected" });
      },
    },
  },
});
