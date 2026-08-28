/**
 * Canva Connect OAuth callback.
 *
 * This is a pure, unauthenticated public server route (same family as
 * api/public/payments/webhook.ts and api/public/health/categories.ts) —
 * Canva's authorization server redirects the user's browser here as a
 * plain GET with no Bearer token available, so requireSupabaseAuth cannot
 * be used. Instead, the authenticated-user binding comes entirely from the
 * server-stored `state` row created by startCanvaConnection
 * (src/lib/canva.functions.ts): only that lookup — never anything in the
 * request itself — determines which AurumVault user this connection
 * belongs to.
 *
 * Replay/CSRF protection: the state row is claimed with a single atomic
 * conditional UPDATE (status: 'pending' -> 'error', WHERE status='pending'
 * AND not expired). Postgres serializes concurrent UPDATEs to the same row,
 * so at most one request can ever win that claim — a replayed callback
 * (same state used twice) finds status != 'pending' and is rejected before
 * any token exchange is attempted. The claimed status starts as 'error' and
 * is only promoted to 'connected' after a successful exchange, so a crash
 * or failed exchange never leaves a row falsely marked pending (exploitable
 * for a second attempt) or falsely marked connected.
 *
 * SAFETY: this file must never log the authorization code, state,
 * code_verifier, access/refresh tokens, or the Canva client secret. Only
 * generic booleans/reasons are logged.
 */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { CANVA_TOKEN_URL, OAUTH_REQUEST_TTL_MS } from "@/lib/canva-oauth";

const SAFE_REDIRECT_BASE = "https://www.aurumvault.store";

function redirectTo(path: string): Response {
  return Response.redirect(`${SAFE_REDIRECT_BASE}${path}`, 302);
}

export const Route = createFileRoute("/api/public/integrations/canva/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");

        if (oauthError) {
          // Canva-reported error (e.g. access_denied) — never forward the
          // raw error_description to the redirect (avoid reflecting
          // arbitrary query content into a URL), just a known reason code.
          return redirectTo("/dashboard/integrations?canva=error&reason=denied");
        }

        if (!code || !state) {
          return redirectTo("/dashboard/integrations?canva=error&reason=missing_params");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const nowIso = new Date().toISOString();
        const { data: claimed, error: claimErr } = await (
          supabaseAdmin.from("integration_connections" as never) as any
        )
          .update({ status: "error" })
          .eq("state", state)
          .eq("status", "pending")
          .gt("request_expires_at", nowIso)
          .select("id,owner_user_id,code_verifier")
          .maybeSingle();

        if (claimErr) {
          console.error("[canva-callback] state claim query failed");
          return redirectTo("/dashboard/integrations?canva=error&reason=server_error");
        }
        if (!claimed) {
          // Either the state never existed, already expired, or (replay
          // attempt) was already claimed by an earlier request.
          return redirectTo("/dashboard/integrations?canva=error&reason=invalid_state");
        }

        const clientId = process.env.CANVA_CLIENT_ID;
        const clientSecret = process.env.CANVA_CLIENT_SECRET;
        const redirectUri = process.env.CANVA_REDIRECT_URI;
        if (!clientId || !clientSecret || !redirectUri) {
          console.error("[canva-callback] Canva OAuth environment variables are not configured");
          return redirectTo("/dashboard/integrations?canva=error&reason=server_error");
        }

        let tokenJson: {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          scope?: string;
        } | null = null;
        try {
          const tokenRes = await fetch(CANVA_TOKEN_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              // HTTP Basic client auth — the standard OAuth 2.0 confidential-
              // client pattern. The secret only ever travels server-to-
              // server, in this one request, never to the browser.
              Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
            },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              // redirect_uri here is always the fixed, server-configured
              // CANVA_REDIRECT_URI — never taken from the incoming request
              // — so it always matches what was sent at the authorize step
              // and what's registered in Canva's dashboard.
              redirect_uri: redirectUri,
              code_verifier: (claimed as any).code_verifier,
              client_id: clientId,
            }).toString(),
          });
          if (tokenRes.ok) {
            tokenJson = await tokenRes.json();
          } else {
            console.error(`[canva-callback] token exchange failed: HTTP ${tokenRes.status}`);
          }
        } catch {
          console.error("[canva-callback] token exchange request threw");
        }

        if (!tokenJson?.access_token) {
          await (supabaseAdmin.from("integration_connections" as never) as any)
            .update({
              status: "error",
              state: null,
              code_verifier: null,
              request_expires_at: null,
            })
            .eq("id", (claimed as any).id);
          return redirectTo("/dashboard/integrations?canva=error&reason=exchange_failed");
        }

        const { encryptIntegrationTokens } = await import("@/lib/oauth-token-crypto.server");
        const envelope = await encryptIntegrationTokens({
          accessToken: tokenJson.access_token,
          ...(tokenJson.refresh_token ? { refreshToken: tokenJson.refresh_token } : {}),
        });
        const tokenExpiresAt = tokenJson.expires_in
          ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
          : null;

        await (supabaseAdmin.from("integration_connections" as never) as any)
          .update({
            status: "connected",
            state: null,
            code_verifier: null,
            request_expires_at: null,
            token_envelope: envelope,
            token_expires_at: tokenExpiresAt,
            scope: tokenJson.scope ?? null,
          })
          .eq("id", (claimed as any).id);

        return redirectTo("/dashboard/integrations?canva=connected");
      },
    },
  },
});

// Re-exported only so tests can assert the TTL used for the claim window
// without duplicating the constant.
export { OAUTH_REQUEST_TTL_MS };
