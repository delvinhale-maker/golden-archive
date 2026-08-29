import { createFileRoute } from "@tanstack/react-router";

/**
 * TikTok Shop seller authorization redirect target. Public by necessity (the
 * provider calls it with no app session), so it authorizes the caller itself:
 * the only trusted input is the opaque, single-use, short-lived `state` value
 * minted by `beginTikTokShopAuthorization`. The claimed state row identifies the
 * user — nothing about the user is ever read from the query string.
 *
 * The state claim is ATOMIC, so a replayed callback cannot consume the same
 * handshake twice. The redirect target is built from the fixed, allow-listed
 * TIKTOK_SHOP_REDIRECT_URI origin, never from the incoming request URL/Host.
 *
 * Never renders tokens, auth codes or secrets; always finishes as a redirect
 * back into the dashboard with a coarse status flag.
 */

const DASHBOARD_PATH = "/dashboard/integrations";

function backTo(origin: string, params: Record<string, string>): Response {
  const url = new URL(DASHBOARD_PATH, origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

export const Route = createFileRoute("/api/public/integrations/tiktok-shop/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const state = url.searchParams.get("state") ?? "";
        // TikTok Shop returns the authorization code as `code`; some flows use
        // `auth_code`. Accept either, exchange server-side only.
        const authCode = url.searchParams.get("code") ?? url.searchParams.get("auth_code") ?? "";
        const providerError = url.searchParams.get("error");

        const {
          integrationAdminClient,
          tiktokShopReturnOrigin,
          isValidStateFormat,
          claimTikTokShopState,
          exchangeTikTokShopCode,
          storeTikTokShopConnection,
          markTikTokShopError,
        } = await import("@/lib/tiktok-shop-oauth");

        let origin: string;
        let supabase;
        try {
          origin = tiktokShopReturnOrigin();
          supabase = await integrationAdminClient();
        } catch {
          return new Response("TikTok Shop integration is not configured", { status: 503 });
        }

        // Malformed / oversized / non-hex state never reaches the database.
        if (!isValidStateFormat(state)) {
          return backTo(origin, { tiktok_shop: "error", reason: "invalid_state" });
        }

        let claimed;
        try {
          claimed = await claimTikTokShopState(supabase, state);
        } catch (err) {
          const reason = err instanceof Error ? err.message : "invalid_state";
          return backTo(origin, {
            tiktok_shop: "error",
            reason: reason === "expired_state" ? "expired_state" : "invalid_state",
          });
        }

        if (providerError || !authCode) {
          await markTikTokShopError(supabase, claimed.id, providerError ?? "missing_code");
          return backTo(origin, { tiktok_shop: "denied" });
        }

        try {
          const tokens = await exchangeTikTokShopCode({ authCode });
          await storeTikTokShopConnection(supabase, {
            rowId: claimed.id,
            ownerUserId: claimed.user_id,
            tokens,
          });
        } catch (err) {
          console.error("[tiktok-shop] token exchange failed", {
            connection_id: claimed.id,
            message: err instanceof Error ? err.message : "unknown",
          });
          await markTikTokShopError(supabase, claimed.id, "token_exchange_failed");
          return backTo(origin, { tiktok_shop: "error", reason: "exchange_failed" });
        }

        return backTo(origin, { tiktok_shop: "connected" });
      },
    },
  },
});
