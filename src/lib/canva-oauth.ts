/**
 * Canva OAuth 2.0 (authorization code + PKCE) — server-only.
 *
 * Reuses the project's existing patterns rather than adding a second
 * integration architecture:
 *   - service-role Supabase client created per call, exactly like
 *     `insiderAdminClient()`;
 *   - envelope encryption via `src/lib/integration-crypto.server.ts`, the same
 *     keyring shape as payout details;
 *   - one row per (user, provider) in `public.integration_connections`, so
 *     re-connecting upserts instead of accumulating rows.
 *
 * NOTE: the backing table is NOT yet applied to the database. Every function
 * here fails closed with a readable error until the proposed migration in
 * docs/proposed-migrations/ is authorized and applied.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-crypto.server";

export const CANVA_PROVIDER = "canva" as const;
export const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";

/** Least-privilege scope set for AurumVault cover/asset workflows. */
export const CANVA_SCOPES = [
  "profile:read",
  "design:meta:read",
  "design:content:read",
  "asset:read",
] as const;

/** A pending handshake is only valid for ten minutes. */
export const STATE_TTL_MS = 10 * 60 * 1000;

export type CanvaConnectionStatus = {
  connected: boolean;
  status: "pending" | "connected" | "revoked" | "error" | "disconnected";
  displayName: string | null;
  scopes: string[];
  connectedAt: string | null;
  expiresAt: string | null;
  lastError: string | null;
};

export function integrationAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server configuration error");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function canvaConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env["CANVA_CLIENT_ID"];
  const clientSecret = process.env["CANVA_CLIENT_SECRET"];
  const redirectUri = process.env["CANVA_REDIRECT_URI"];
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Canva integration is not configured");
  }
  return { clientId, clientSecret, redirectUri };
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 7636 §4.1 verifier: 43–128 unreserved chars. */
export function createCodeVerifier(): string {
  return base64UrlFromBytes(crypto.getRandomValues(new Uint8Array(48)));
}

/** RFC 7636 §4.2 S256 challenge. */
export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlFromBytes(new Uint8Array(digest));
}

export function buildCanvaAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: readonly string[];
}): string {
  const url = new URL(CANVA_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("scope", (args.scopes ?? CANVA_SCOPES).join(" "));
  url.searchParams.set("state", args.state);
  url.searchParams.set("code_challenge", args.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/**
 * Opens (or restarts) an authorization handshake for one user. The PKCE verifier
 * is stored encrypted; the opaque `state` is the only value that travels through
 * the browser. Idempotent per (user, provider) via the unique index.
 */
export async function beginCanvaAuthorization(userId: string): Promise<{ authorizeUrl: string }> {
  const { clientId, redirectUri } = canvaConfig();
  const supabase = integrationAdminClient();

  const state = randomHex(24);
  const verifier = createCodeVerifier();
  const codeChallenge = await deriveCodeChallenge(verifier);

  const { error } = await supabase.from("integration_connections").upsert(
    {
      user_id: userId,
      provider: CANVA_PROVIDER,
      status: "pending",
      oauth_state: state,
      code_verifier_enc: await encryptIntegrationSecret(verifier),
      state_expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
      last_error: null,
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(`Unable to start Canva authorization: ${error.message}`);

  return {
    authorizeUrl: buildCanvaAuthorizeUrl({ clientId, redirectUri, state, codeChallenge }),
  };
}

export type CanvaTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

/** Confidential-client token exchange (Basic auth, per Canva Connect docs). */
export async function exchangeCanvaCode(args: {
  code: string;
  codeVerifier: string;
}): Promise<CanvaTokenResponse> {
  const { clientId, clientSecret, redirectUri } = canvaConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    code_verifier: args.codeVerifier,
    redirect_uri: redirectUri,
  });
  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Canva token exchange failed (${res.status})`);
  return (await res.json()) as CanvaTokenResponse;
}

export async function refreshCanvaToken(refreshToken: string): Promise<CanvaTokenResponse> {
  const { clientId, clientSecret } = canvaConfig();
  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Canva token refresh failed (${res.status})`);
  return (await res.json()) as CanvaTokenResponse;
}

type PendingRow = {
  id: string;
  user_id: string;
  code_verifier_enc: unknown;
  state_expires_at: string | null;
};

/** Look up a pending handshake by opaque state, rejecting expired ones. */
export async function consumeCanvaState(
  supabase: SupabaseClient,
  state: string,
): Promise<{ row: PendingRow; codeVerifier: string }> {
  const { data, error } = await supabase
    .from("integration_connections")
    .select("id, user_id, code_verifier_enc, state_expires_at")
    .eq("provider", CANVA_PROVIDER)
    .eq("oauth_state", state)
    .maybeSingle();
  if (error) throw new Error(`Unable to verify authorization state: ${error.message}`);
  const row = data as PendingRow | null;
  if (!row) throw new Error("invalid_state");
  if (!row.state_expires_at || new Date(row.state_expires_at).getTime() < Date.now()) {
    throw new Error("expired_state");
  }
  return { row, codeVerifier: await decryptIntegrationSecret(row.code_verifier_enc) };
}

/** Persist an established connection and clear all handshake state. */
export async function storeCanvaConnection(
  supabase: SupabaseClient,
  args: { rowId: string; tokens: CanvaTokenResponse },
): Promise<void> {
  const expiresAt = args.tokens.expires_in
    ? new Date(Date.now() + args.tokens.expires_in * 1000).toISOString()
    : null;
  const { error } = await supabase
    .from("integration_connections")
    .update({
      status: "connected",
      access_token_enc: await encryptIntegrationSecret(args.tokens.access_token),
      refresh_token_enc: args.tokens.refresh_token
        ? await encryptIntegrationSecret(args.tokens.refresh_token)
        : null,
      access_token_expires_at: expiresAt,
      scopes: args.tokens.scope ? args.tokens.scope.split(" ").filter(Boolean) : [...CANVA_SCOPES],
      last_connected_at: new Date().toISOString(),
      oauth_state: null,
      code_verifier_enc: null,
      state_expires_at: null,
      last_error: null,
    })
    .eq("id", args.rowId);
  if (error) throw new Error(`Unable to store Canva connection: ${error.message}`);
}

export async function markCanvaError(
  supabase: SupabaseClient,
  rowId: string,
  reason: string,
): Promise<void> {
  await supabase
    .from("integration_connections")
    .update({
      status: "error",
      last_error: reason.slice(0, 300),
      oauth_state: null,
      code_verifier_enc: null,
      state_expires_at: null,
    })
    .eq("id", rowId);
}

/** Non-secret status for the owning user only. */
export async function readCanvaStatus(userId: string): Promise<CanvaConnectionStatus> {
  const supabase = integrationAdminClient();
  const { data } = await supabase
    .from("integration_connections")
    .select(
      "status, external_display_name, scopes, last_connected_at, access_token_expires_at, last_error",
    )
    .eq("provider", CANVA_PROVIDER)
    .eq("user_id", userId)
    .maybeSingle();

  const row = data as {
    status: CanvaConnectionStatus["status"];
    external_display_name: string | null;
    scopes: string[] | null;
    last_connected_at: string | null;
    access_token_expires_at: string | null;
    last_error: string | null;
  } | null;

  if (!row) {
    return {
      connected: false,
      status: "disconnected",
      displayName: null,
      scopes: [],
      connectedAt: null,
      expiresAt: null,
      lastError: null,
    };
  }
  return {
    connected: row.status === "connected",
    status: row.status,
    displayName: row.external_display_name,
    scopes: row.scopes ?? [],
    connectedAt: row.last_connected_at,
    expiresAt: row.access_token_expires_at,
    lastError: row.last_error,
  };
}

/** Revoke locally: wipe every secret column, keep the row for audit continuity. */
export async function disconnectCanva(userId: string): Promise<void> {
  const supabase = integrationAdminClient();
  const { error } = await supabase
    .from("integration_connections")
    .update({
      status: "revoked",
      access_token_enc: null,
      refresh_token_enc: null,
      access_token_expires_at: null,
      oauth_state: null,
      code_verifier_enc: null,
      state_expires_at: null,
    })
    .eq("provider", CANVA_PROVIDER)
    .eq("user_id", userId);
  if (error) throw new Error(`Unable to disconnect Canva: ${error.message}`);
}
