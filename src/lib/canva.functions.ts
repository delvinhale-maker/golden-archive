/**
 * AurumVault Canva Connect OAuth — authenticated server functions.
 *
 * The actual authorization-code exchange happens in the callback route
 * (src/routes/api/public/integrations/canva/callback.ts), not here — that
 * route can't use requireSupabaseAuth at all (Canva's redirect carries no
 * Bearer token), so it authenticates the request by looking up the
 * server-stored `state` value instead. Everything in this file runs in a
 * normal authenticated request from the AurumVault dashboard.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  generateOAuthState,
  generateCodeVerifier,
  deriveCodeChallenge,
  buildCanvaAuthorizeUrl,
  OAUTH_REQUEST_TTL_MS,
  CANVA_REVOKE_URL,
} from "@/lib/canva-oauth";

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

/**
 * Start a Canva connection. Generates state + PKCE, persists them against
 * the authenticated user via the service-role client (this table has no
 * authenticated-role write policy at all — see the migration), and returns
 * the URL the browser should navigate to. The client never sees the
 * code_verifier or anything Canva-secret.
 */
export const startCanvaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ authorizeUrl: string }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const clientId = getEnv("CANVA_CLIENT_ID");
    const redirectUri = getEnv("CANVA_REDIRECT_URI");

    const state = generateOAuthState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await deriveCodeChallenge(codeVerifier);
    const requestExpiresAt = new Date(Date.now() + OAUTH_REQUEST_TTL_MS).toISOString();

    // Upsert on (owner_user_id, provider): starting a new connection
    // attempt always resets any prior pending/revoked/error row for this
    // user+provider rather than accumulating duplicates. Any leftover token
    // material from a previous connection is cleared here too.
    const { error } = await (supabaseAdmin.from("integration_connections" as never) as any).upsert(
      {
        owner_user_id: userId,
        provider: "canva",
        status: "pending",
        state,
        code_verifier: codeVerifier,
        request_expires_at: requestExpiresAt,
        token_envelope: null,
        token_expires_at: null,
        scope: null,
      },
      { onConflict: "owner_user_id,provider" },
    );
    if (error) throw new Error("Couldn't start Canva connection");

    const authorizeUrl = buildCanvaAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
    });

    return { authorizeUrl };
  });

export type CanvaConnectionStatus = {
  connected: boolean;
  status: "not_connected" | "pending" | "connected" | "revoked" | "error";
  connectedAt: string | null;
};

/**
 * Only ever reads the non-sensitive columns — the RLS-bound client is used
 * deliberately here (not service-role) as a second, independent guarantee
 * that this can never return token material even if a future edit to this
 * function tried to select more columns: the database itself would refuse
 * to return anything beyond what's column-granted to `authenticated`.
 */
export const getCanvaConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CanvaConnectionStatus> => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("integration_connections" as never)
      .select("status,updated_at" as never)
      .eq("owner_user_id" as never, userId)
      .eq("provider" as never, "canva")
      .maybeSingle();

    if (!row) return { connected: false, status: "not_connected", connectedAt: null };
    const r = row as any;
    return {
      connected: r.status === "connected",
      status: r.status,
      connectedAt: r.status === "connected" ? r.updated_at : null,
    };
  });

/**
 * Disconnect Canva. Best-effort revokes the token with Canva first (never
 * blocks local cleanup if that call fails — matches this codebase's
 * established best-effort-side-effect convention, e.g. the QR redirect
 * route's scan-event insert), then always clears all locally stored
 * credentials for this user's Canva connection regardless of whether the
 * remote revoke succeeded.
 */
export const disconnectCanva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptIntegrationTokens } = await import("@/lib/oauth-token-crypto.server");

    const { data: row } = await supabaseAdmin
      .from("integration_connections" as never)
      .select("id,status,token_envelope" as never)
      .eq("owner_user_id" as never, userId)
      .eq("provider" as never, "canva")
      .maybeSingle();

    if (row && (row as any).status === "connected" && (row as any).token_envelope) {
      try {
        const tokens = await decryptIntegrationTokens((row as any).token_envelope);
        if (tokens.accessToken) {
          const clientId = process.env.CANVA_CLIENT_ID;
          const clientSecret = process.env.CANVA_CLIENT_SECRET;
          if (clientId && clientSecret) {
            await fetch(CANVA_REVOKE_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
              },
              body: new URLSearchParams({ token: tokens.accessToken }).toString(),
            });
          }
        }
      } catch {
        // Best-effort — never block local disconnect on Canva's revoke
        // endpoint being unreachable or already-invalid.
      }
    }

    await (supabaseAdmin.from("integration_connections" as never) as any)
      .update({
        status: "revoked",
        state: null,
        code_verifier: null,
        request_expires_at: null,
        token_envelope: null,
        token_expires_at: null,
        scope: null,
      })
      .eq("owner_user_id", userId)
      .eq("provider", "canva");

    return { ok: true };
  });
