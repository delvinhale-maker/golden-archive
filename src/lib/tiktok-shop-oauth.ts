/**
 * TikTok Shop (Partner Center / ISV) seller authorization — canonical core.
 *
 * ONE implementation for the whole app: opaque state minting, authorize-URL
 * building, atomic single-use state claiming, token exchange/refresh, connection
 * storage, non-secret status reads and disconnect.
 *
 * Reuses the EXISTING integration architecture unchanged:
 *   - storage: `public.integration_connections` (provider = 'tiktok_shop')
 *   - crypto:  `oauth-token-crypto.server.ts` (single four-slot keyring
 *              V4 → V3 → V2 → original; no second key, no second envelope)
 *   - admin client: the project's service-role singleton
 *
 * Security posture (matches Canva):
 *   - `state` is opaque hex, length/charset validated BEFORE any DB lookup,
 *     TTL-bounded (10 min) and claimed ATOMICALLY (conditional UPDATE), so a
 *     replayed callback can never consume the same handshake twice;
 *   - access/refresh tokens are envelope-encrypted at rest, never returned to
 *     the browser and never logged;
 *   - the app secret only ever travels in the server-side token request body;
 *   - writes are scoped by the owning `user_id`, taken from verified auth
 *     context only — never from browser input;
 *   - the post-callback redirect base is fixed from the allow-listed
 *     TIKTOK_SHOP_REDIRECT_URI, never derived from the incoming request/Host.
 *
 * PROTOCOL NOTE (important, per official TikTok Shop docs):
 *   TikTok Shop's seller authorization URL takes `service_id` (+ optional
 *   `state`). The redirect/callback URL is registered in Partner Center against
 *   the app and is NOT passed as a query parameter, and there is no PKCE. The
 *   exact registered callback must therefore equal TIKTOK_SHOP_REDIRECT_URI:
 *   https://www.aurumvault.store/api/public/integrations/tiktok-shop/callback
 *
 * DATABASE NOTE: `integration_connections.provider` currently has a CHECK
 *   constraint allowing only 'canva'. Until the additive widening migration in
 *   docs/proposed-migrations/ is authorized and applied, every write here fails
 *   closed with a readable error. Nothing else about the table changes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptOAuthSecret, encryptOAuthSecret } from "./oauth-token-crypto.server";
import {
  STATE_MAX_LENGTH,
  STATE_MIN_LENGTH,
  STATE_TTL_MS,
  createOAuthState,
  integrationAdminClient,
  isValidStateFormat,
} from "./canva-oauth";

export {
  integrationAdminClient,
  STATE_MAX_LENGTH,
  STATE_MIN_LENGTH,
  STATE_TTL_MS,
  createOAuthState,
  isValidStateFormat,
} from "./canva-oauth";

export const TIKTOK_SHOP_PROVIDER = "tiktok_shop" as const;

/** US (local seller) authorization host per TikTok Shop Partner Center docs. */
export const TIKTOK_SHOP_AUTHORIZE_URL = "https://services.us.tiktokshop.com/open/authorize";
export const TIKTOK_SHOP_TOKEN_URL = "https://auth.tiktok-shops.com/api/v2/token/get";
export const TIKTOK_SHOP_TOKEN_REFRESH_URL = "https://auth.tiktok-shops.com/api/v2/token/refresh";

export type TikTokShopConnectionStatus = {
  connected: boolean;
  status: "pending" | "connected" | "revoked" | "error" | "disconnected";
  displayName: string | null;
  scopes: string[];
  connectedAt: string | null;
  expiresAt: string | null;
  lastError: string | null;
};

export function tiktokShopConfig(): {
  appKey: string;
  appSecret: string;
  serviceId: string;
  redirectUri: string;
} {
  const appKey = process.env["TIKTOK_SHOP_APP_KEY"];
  const appSecret = process.env["TIKTOK_SHOP_APP_SECRET"];
  const redirectUri = process.env["TIKTOK_SHOP_REDIRECT_URI"];
  // TikTok Shop identifies the authorization entry point by service id, which
  // is issued alongside the app key in Partner Center.
  const serviceId = process.env["TIKTOK_SHOP_SERVICE_ID"];
  if (!appKey || !appSecret || !redirectUri || !serviceId) {
    throw new Error("TikTok Shop integration is not configured");
  }
  return { appKey, appSecret, serviceId, redirectUri };
}

/** Fixed, allow-listed redirect base — spoofed Host headers cannot influence it. */
export function tiktokShopReturnOrigin(): string {
  return new URL(tiktokShopConfig().redirectUri).origin;
}

export function buildTikTokShopAuthorizeUrl(args: {
  serviceId: string;
  state: string;
  /**
   * Not a TikTok query parameter — the callback is registered in Partner Center.
   * Accepted here so callers/tests can assert the configured value is the exact
   * production callback before a handshake is ever started.
   */
  redirectUri: string;
}): string {
  assertCanonicalRedirectUri(args.redirectUri);
  const url = new URL(TIKTOK_SHOP_AUTHORIZE_URL);
  url.searchParams.set("service_id", args.serviceId);
  url.searchParams.set("state", args.state);
  return url.toString();
}

export const TIKTOK_SHOP_CANONICAL_REDIRECT_URI =
  "https://www.aurumvault.store/api/public/integrations/tiktok-shop/callback";

/** Guard against typos, trailing slashes, wrong hosts and preview domains. */
export function assertCanonicalRedirectUri(value: string): void {
  if (value !== TIKTOK_SHOP_CANONICAL_REDIRECT_URI) {
    throw new Error("TikTok Shop redirect URI is not the approved production callback");
  }
}

/** Opens (or restarts) a seller authorization handshake for one AurumVault user. */
export async function beginTikTokShopAuthorization(
  userId: string,
): Promise<{ authorizeUrl: string }> {
  const { serviceId, redirectUri } = tiktokShopConfig();
  const supabase = await integrationAdminClient();

  const state = createOAuthState();
  const { error } = await supabase.from("integration_connections").upsert(
    {
      user_id: userId,
      provider: TIKTOK_SHOP_PROVIDER,
      status: "pending",
      oauth_state: state,
      state_expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
      last_error: null,
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(`Unable to start TikTok Shop authorization: ${error.message}`);

  return { authorizeUrl: buildTikTokShopAuthorizeUrl({ serviceId, state, redirectUri }) };
}

export type TikTokShopTokenResponse = {
  access_token: string;
  refresh_token?: string;
  access_token_expire_in?: number;
  refresh_token_expire_in?: number;
  seller_name?: string;
  seller_base_region?: string;
  granted_scopes?: string[];
};

type TikTokShopTokenEnvelope = {
  code?: number;
  message?: string;
  data?: TikTokShopTokenResponse;
};

/** Server-side only token exchange. The app secret never leaves the server. */
export async function exchangeTikTokShopCode(args: {
  authCode: string;
}): Promise<TikTokShopTokenResponse> {
  const { appKey, appSecret } = tiktokShopConfig();
  const url = new URL(TIKTOK_SHOP_TOKEN_URL);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("app_secret", appSecret);
  url.searchParams.set("auth_code", args.authCode);
  url.searchParams.set("grant_type", "authorized_code");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`TikTok Shop token exchange failed (${res.status})`);
  const body = (await res.json()) as TikTokShopTokenEnvelope;
  if (body.code !== 0 || !body.data?.access_token) {
    throw new Error("TikTok Shop token exchange rejected");
  }
  return body.data;
}

export async function refreshTikTokShopToken(
  refreshToken: string,
): Promise<TikTokShopTokenResponse> {
  const { appKey, appSecret } = tiktokShopConfig();
  const url = new URL(TIKTOK_SHOP_TOKEN_REFRESH_URL);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("app_secret", appSecret);
  url.searchParams.set("refresh_token", refreshToken);
  url.searchParams.set("grant_type", "refresh_token");

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`TikTok Shop token refresh failed (${res.status})`);
  const body = (await res.json()) as TikTokShopTokenEnvelope;
  if (body.code !== 0 || !body.data?.access_token) {
    throw new Error("TikTok Shop token refresh rejected");
  }
  return body.data;
}

export type ClaimedTikTokShopState = { id: string; user_id: string };

/**
 * ATOMIC single-use state claim: one conditional UPDATE matches the pending,
 * unexpired state and clears it, returning the row only to the first caller.
 * Throws `invalid_state` or `expired_state`.
 */
export async function claimTikTokShopState(
  supabase: SupabaseClient,
  state: string,
): Promise<ClaimedTikTokShopState> {
  if (!isValidStateFormat(state)) throw new Error("invalid_state");

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("integration_connections")
    .update({ oauth_state: null, state_expires_at: null })
    .eq("provider", TIKTOK_SHOP_PROVIDER)
    .eq("oauth_state", state)
    .gt("state_expires_at", nowIso)
    .select("id, user_id")
    .maybeSingle();

  if (error) throw new Error(`Unable to verify authorization state: ${error.message}`);

  const row = data as ClaimedTikTokShopState | null;
  if (!row) {
    const { data: stale } = await supabase
      .from("integration_connections")
      .select("id")
      .eq("provider", TIKTOK_SHOP_PROVIDER)
      .eq("oauth_state", state)
      .maybeSingle();
    throw new Error(stale ? "expired_state" : "invalid_state");
  }
  return row;
}

/** Persist an established connection and clear all handshake values. */
export async function storeTikTokShopConnection(
  supabase: SupabaseClient,
  args: { rowId: string; ownerUserId: string; tokens: TikTokShopTokenResponse },
): Promise<void> {
  const expiresAt = args.tokens.access_token_expire_in
    ? new Date(args.tokens.access_token_expire_in * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from("integration_connections")
    .update({
      status: "connected",
      access_token_enc: await encryptOAuthSecret(args.tokens.access_token),
      refresh_token_enc: args.tokens.refresh_token
        ? await encryptOAuthSecret(args.tokens.refresh_token)
        : null,
      access_token_expires_at: expiresAt,
      external_display_name: args.tokens.seller_name ?? null,
      scopes: args.tokens.granted_scopes ?? [],
      last_connected_at: new Date().toISOString(),
      oauth_state: null,
      state_expires_at: null,
      last_error: null,
    })
    .eq("id", args.rowId)
    .eq("user_id", args.ownerUserId);
  if (error) throw new Error(`Unable to store TikTok Shop connection: ${error.message}`);
}

export async function markTikTokShopError(
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
      state_expires_at: null,
    })
    .eq("id", rowId);
}

/**
 * Non-secret status for the owning user only. Prefers the caller's RLS-bound
 * authenticated client; encrypted token columns are never selected (and are not
 * granted to `authenticated` at all).
 */
export async function readTikTokShopStatus(
  userId: string,
  rlsClient?: SupabaseClient,
): Promise<TikTokShopConnectionStatus> {
  const supabase = rlsClient ?? (await integrationAdminClient());
  const { data } = await supabase
    .from("integration_connections")
    .select(
      "status, external_display_name, scopes, last_connected_at, access_token_expires_at, last_error",
    )
    .eq("provider", TIKTOK_SHOP_PROVIDER)
    .eq("user_id", userId)
    .maybeSingle();

  const row = data as {
    status: TikTokShopConnectionStatus["status"];
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

/**
 * Disconnect for the authenticated owner.
 *
 * TikTok Shop exposes no public token-revocation endpoint for ISV apps
 * (deauthorization is seller-initiated in Seller Center), so there is no remote
 * call to fake here. The local credential wipe always happens.
 */
export async function disconnectTikTokShop(
  userId: string,
): Promise<{ remoteRevoked: boolean; localWiped: true }> {
  const supabase = await integrationAdminClient();
  const { error } = await supabase
    .from("integration_connections")
    .update({
      status: "revoked",
      access_token_enc: null,
      refresh_token_enc: null,
      access_token_expires_at: null,
      oauth_state: null,
      state_expires_at: null,
    })
    .eq("provider", TIKTOK_SHOP_PROVIDER)
    .eq("user_id", userId);
  if (error) throw new Error(`Unable to disconnect TikTok Shop: ${error.message}`);
  return { remoteRevoked: false, localWiped: true };
}

/** Decrypt seam used by future authenticated TikTok Shop API calls. */
export async function readTikTokShopAccessToken(userId: string): Promise<string | null> {
  const supabase = await integrationAdminClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("access_token_enc")
    .eq("provider", TIKTOK_SHOP_PROVIDER)
    .eq("user_id", userId)
    .maybeSingle();
  const sealed = (data as { access_token_enc: unknown } | null)?.access_token_enc;
  return sealed ? await decryptOAuthSecret(sealed) : null;
}
