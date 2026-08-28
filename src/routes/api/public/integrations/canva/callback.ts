import { createFileRoute } from "@tanstack/react-router";

/**
 * Canva OAuth redirect target. Public by necessity (the provider calls it with
 * no app session), so it authorizes the caller itself: the only trusted input is
 * the opaque, single-use, short-lived `state` value minted by
 * `beginCanvaAuthorization`. The claimed state row identifies the user — nothing
 * about the user is ever read from the query string.
 *
 * The state claim is ATOMIC, so a replayed callback cannot consume the same
 * handshake twice. The redirect target is built from the fixed, allow-listed
 * CANVA_REDIRECT_URI origin, never from the incoming request URL.
 *
 * Never renders tokens or secrets; always finishes as a redirect back into the
 * dashboard with a coarse status flag.
 */

const DASHBOARD_PATH = "/dashboard/integrations";

function backTo(origin: string, params: Record<string, string>): Response {
  const url = new URL(DASHBOARD_PATH, origin);
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

        const {
          integrationAdminClient,
          canvaReturnOrigin,
          isValidStateFormat,
          claimCanvaState,
          exchangeCanvaCode,
          storeCanvaConnection,
          markCanvaError,
        } = await import("@/lib/canva-oauth");

        let origin: string;
        let supabase;
        try {
          origin = canvaReturnOrigin();
          supabase = integrationAdminClient();
        } catch {
          return new Response("Canva integration is not configured", { status: 503 });
        }

        // Malformed / oversized / non-hex state never reaches the database.
        if (!isValidStateFormat(state)) {
          return backTo(origin, { canva: "error", reason: "invalid_state" });
        }

        let claimed;
        try {
          claimed = await claimCanvaState(supabase, state);
        } catch (err) {
          const reason = err instanceof Error ? err.message : "invalid_state";
          return backTo(origin, {
            canva: "error",
            reason: reason === "expired_state" ? "expired_state" : "invalid_state",
          });
        }

        if (providerError || !code) {
          await markCanvaError(supabase, claimed.id, providerError ?? "missing_code");
          return backTo(origin, { canva: "denied" });
        }

        try {
          const tokens = await exchangeCanvaCode({ code, codeVerifier: claimed.codeVerifier });
          if (!tokens.access_token) throw new Error("no_access_token");
          await storeCanvaConnection(supabase, {
            rowId: claimed.id,
            ownerUserId: claimed.user_id,
            tokens,
          });
        } catch (err) {
          console.error("[canva] token exchange failed", {
            connection_id: claimed.id,
            message: err instanceof Error ? err.message : "unknown",
          });
          await markCanvaError(supabase, claimed.id, "token_exchange_failed");
          return backTo(origin, { canva: "error", reason: "exchange_failed" });
        }

        return backTo(origin, { canva: "connected" });
      },
    },
  },
});
