/**
 * Canva OAuth 2.0 (authorization code + PKCE) — canonical core.
 *
 * ONE implementation for the whole app: PKCE minting, authorize-URL building,
 * atomic single-use state claiming, token exchange/refresh, connection storage,
 * status reads and disconnect (with remote token revocation).
 *
 * Security posture:
 *   - the PKCE verifier and both tokens are encrypted at rest through the single
 *     OAuth keyring in `oauth-token-crypto.server.ts`;
 *   - `state` is opaque, length/charset validated, expiry enforced, and claimed
 *     ATOMICALLY (conditional UPDATE), so a replayed callback can never consume
 *     the same handshake twice;
 *   - writes are scoped by the owning `user_id` so a connection row can never be
 *     re-pointed at another user;
 *   - the post-callback redirect base is fixed from the allow-listed
 *     CANVA_REDIRECT_URI, never derived from the incoming request;
 *   - service-role access only — the table grants nothing to anon/authenticated.
 *
 * NOTE: the backing table `public.integration_connections` is NOT yet applied to
 * the database (see docs/proposed-migrations/). Every DB call fails closed with a
 * readable error until that migration is authorized and applied.
 *
 * This module also holds the design-discovery/export client
 * (listCanvaDesigns, getCanvaDesign, exportCanvaDesign) and the
 * getValidCanvaAccessToken() helper that keeps the browse/export path
 * supplied with a live token — refreshing it when expired, and reporting a
 * typed CanvaReauthRequiredError when refresh isn't possible so the caller
 * can show a reconnect flow instead of a false success.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptOAuthSecret, encryptOAuthSecret } from "./oauth-token-crypto.server";

export const CANVA_PROVIDER = "canva" as const;
export const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
export const CANVA_REVOKE_URL = "https://api.canva.com/rest/v1/oauth/revoke";

/** Canva Connect expects the lowercase form of the S256 method. */
export const CANVA_CODE_CHALLENGE_METHOD = "s256" as const;

/**
 * Least-privilege Canva Connect scope set for the current AurumVault workflow:
 * browse a creator's designs, preview one, and export/import it into a
 * product draft. Guarded by a regression test so it cannot silently drift.
 *
 *   profile:read         - verify the connection and show a display name
 *   design:meta:read      - list designs, read title/thumbnail/timestamps
 *   design:content:read   - create a design export job (Turn Into Product)
 *
 * Deliberately excluded: asset:read / asset:write (no /v1/assets calls in
 * this workflow — design thumbnails and exports are covered by the two
 * design:* scopes above) and design:content:write (AurumVault never creates
 * or modifies a Canva design). Widen this set only when a concrete feature
 * needs the extra permission, per Canva's least-privilege guidance.
 */
export const CANVA_SCOPES = ["profile:read", "design:meta:read", "design:content:read"] as const;

/** A pending handshake is only valid for ten minutes. */
export const STATE_TTL_MS = 10 * 60 * 1000;

export const STATE_MIN_LENGTH = 16;
export const STATE_MAX_LENGTH = 128;

export type CanvaConnectionStatus = {
  connected: boolean;
  status: "pending" | "connected" | "revoked" | "error" | "disconnected";
  displayName: string | null;
  scopes: string[];
  connectedAt: string | null;
  expiresAt: string | null;
  lastError: string | null;
};

/**
 * Privileged client for writes and decrypt paths only. Reuses the project's
 * established service-role singleton (`@/integrations/supabase/client.server`)
 * instead of hand-rolling a second admin client. Loaded dynamically so the
 * server-only module never enters a client bundle.
 */
export async function integrationAdminClient(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
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

/**
 * Fixed, allow-listed redirect base: the origin is taken from the configured
 * redirect URI, so a spoofed Host/`request.url` cannot bounce the user offsite.
 */
export function canvaReturnOrigin(): string {
  return new URL(canvaConfig().redirectUri).origin;
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

/** RFC 7636 §4.2 S256 challenge (base64url of SHA-256). */
export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlFromBytes(new Uint8Array(digest));
}

/** Opaque handshake state: hex, length-bounded, high entropy. */
export function createOAuthState(): string {
  return randomHex(24);
}

/**
 * Sanity-validate a state value arriving from the browser before any DB work.
 * Rejects empty, short, oversized and malformed values so the callback never
 * runs a lookup on attacker-shaped input.
 */
export function isValidStateFormat(state: unknown): state is string {
  return (
    typeof state === "string" &&
    state.length >= STATE_MIN_LENGTH &&
    state.length <= STATE_MAX_LENGTH &&
    /^[0-9a-f]+$/.test(state)
  );
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
  url.searchParams.set("code_challenge_method", CANVA_CODE_CHALLENGE_METHOD);
  return url.toString();
}

/**
 * Opens (or restarts) an authorization handshake for one user. The PKCE verifier
 * is stored ENCRYPTED; the opaque `state` is the only value that travels through
 * the browser. Idempotent per (user, provider) via the unique index.
 */
export async function beginCanvaAuthorization(userId: string): Promise<{ authorizeUrl: string }> {
  const { clientId, redirectUri } = canvaConfig();
  const supabase = await integrationAdminClient();

  const state = createOAuthState();
  const verifier = createCodeVerifier();
  const codeChallenge = await deriveCodeChallenge(verifier);

  const { error } = await supabase.from("integration_connections").upsert(
    {
      user_id: userId,
      provider: CANVA_PROVIDER,
      status: "pending",
      oauth_state: state,
      code_verifier_enc: await encryptOAuthSecret(verifier),
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
  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: args.code,
      code_verifier: args.codeVerifier,
      redirect_uri: redirectUri,
    }),
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

/** Best-effort remote revocation; the local wipe proceeds regardless. */
export async function revokeCanvaTokenRemotely(token: string): Promise<boolean> {
  try {
    const { clientId, clientSecret } = canvaConfig();
    const res = await fetch(CANVA_REVOKE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type ClaimedState = {
  id: string;
  user_id: string;
  codeVerifier: string;
};

/**
 * ATOMIC single-use state claim.
 *
 * One conditional UPDATE both matches the pending state (unexpired) and clears
 * it, returning the row only to the first caller. A replayed callback finds no
 * matching row, so the same authorization code can never be exchanged twice.
 * Throws `invalid_state` or `expired_state`.
 */
export async function claimCanvaState(
  supabase: SupabaseClient,
  state: string,
): Promise<ClaimedState> {
  if (!isValidStateFormat(state)) throw new Error("invalid_state");

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("integration_connections")
    .update({ oauth_state: null, state_expires_at: null })
    .eq("provider", CANVA_PROVIDER)
    .eq("oauth_state", state)
    .gt("state_expires_at", nowIso)
    .select("id, user_id, code_verifier_enc")
    .maybeSingle();

  if (error) throw new Error(`Unable to verify authorization state: ${error.message}`);

  const row = data as { id: string; user_id: string; code_verifier_enc: unknown } | null;
  if (!row) {
    // Classification only (no secrets, no mutation): expired or unknown?
    const { data: stale } = await supabase
      .from("integration_connections")
      .select("id")
      .eq("provider", CANVA_PROVIDER)
      .eq("oauth_state", state)
      .maybeSingle();
    throw new Error(stale ? "expired_state" : "invalid_state");
  }

  return {
    id: row.id,
    user_id: row.user_id,
    codeVerifier: await decryptOAuthSecret(row.code_verifier_enc),
  };
}

/**
 * Persist an established connection and clear all handshake state. Scoped by
 * BOTH row id and owner id, so a row can never be reassigned to another user.
 */
export async function storeCanvaConnection(
  supabase: SupabaseClient,
  args: {
    rowId: string;
    ownerUserId: string;
    tokens: CanvaTokenResponse;
    displayName?: string | null;
  },
): Promise<void> {
  const expiresAt = args.tokens.expires_in
    ? new Date(Date.now() + args.tokens.expires_in * 1000).toISOString()
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
      scopes: args.tokens.scope ? args.tokens.scope.split(" ").filter(Boolean) : [...CANVA_SCOPES],
      last_connected_at: new Date().toISOString(),
      oauth_state: null,
      code_verifier_enc: null,
      state_expires_at: null,
      last_error: null,
      ...(args.displayName !== undefined ? { external_display_name: args.displayName } : {}),
    })
    .eq("id", args.rowId)
    .eq("user_id", args.ownerUserId);
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

/**
 * Non-secret status for the owning user only.
 *
 * Defence in depth: prefer an RLS-bound authenticated client (the caller's own
 * `context.supabase`), so the read is constrained by the owner policy as well as
 * by the explicit `user_id` filter. Encrypted token columns are never selected —
 * and the migration grants `authenticated` column-level SELECT on the non-secret
 * columns only, so they are not reachable on this path at all. Falls back to the
 * privileged client when no user-scoped client is supplied (e.g. server jobs).
 */
export async function readCanvaStatus(
  userId: string,
  rlsClient?: SupabaseClient,
): Promise<CanvaConnectionStatus> {
  const supabase = rlsClient ?? (await integrationAdminClient());
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

/**
 * Disconnect: revoke remotely at Canva first (best effort), then wipe every
 * secret column locally. The row is kept for audit continuity.
 */
export async function disconnectCanva(userId: string): Promise<{ remoteRevoked: boolean }> {
  const supabase = await integrationAdminClient();

  const { data } = await supabase
    .from("integration_connections")
    .select("id, refresh_token_enc, access_token_enc")
    .eq("provider", CANVA_PROVIDER)
    .eq("user_id", userId)
    .maybeSingle();

  const row = data as { id: string; refresh_token_enc: unknown; access_token_enc: unknown } | null;

  let remoteRevoked = false;
  const sealed = row?.refresh_token_enc ?? row?.access_token_enc;
  if (sealed) {
    try {
      remoteRevoked = await revokeCanvaTokenRemotely(await decryptOAuthSecret(sealed));
    } catch {
      remoteRevoked = false;
    }
  }

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

  return { remoteRevoked };
}

// ---------------------------------------------------------------------------
// Design discovery / export client
// ---------------------------------------------------------------------------

export const CANVA_API_BASE = "https://api.canva.com/rest/v1";

/** Typed failure reasons the UI needs to render distinct, honest states for. */
export type CanvaApiFailureReason =
  | "not_connected"
  | "reauth_required"
  | "rate_limited"
  | "design_unavailable"
  | "export_failed"
  | "export_timeout"
  | "api_error";

export class CanvaApiError extends Error {
  reason: CanvaApiFailureReason;
  status: number | undefined;
  retryAfterSeconds: number | undefined;

  constructor(
    reason: CanvaApiFailureReason,
    message: string,
    opts: { status?: number; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "CanvaApiError";
    this.reason = reason;
    this.status = opts.status;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

function parseRetryAfter(res: Response): number | undefined {
  const header = res.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

/** Wraps a Canva Connect API response, classifying auth/rate-limit/other failures. */
async function canvaApiFetch(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${CANVA_API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (err) {
    throw new CanvaApiError(
      "api_error",
      err instanceof Error ? err.message : "Canva API request failed",
    );
  }

  if (res.status === 401) {
    throw new CanvaApiError("reauth_required", "Canva authorization has expired or was revoked");
  }
  if (res.status === 429) {
    throw new CanvaApiError("rate_limited", "Canva API rate limit reached", {
      status: 429,
      retryAfterSeconds: parseRetryAfter(res),
    });
  }
  if (res.status === 404) {
    throw new CanvaApiError("design_unavailable", "The Canva design is no longer available", {
      status: 404,
    });
  }
  if (!res.ok) {
    throw new CanvaApiError("api_error", `Canva API request failed (${res.status})`, {
      status: res.status,
    });
  }
  return res.json();
}

/**
 * Returns a live Canva access token for this user, refreshing it first when
 * expired (or close to expiring). Throws a typed CanvaApiError so callers can
 * render "not connected" vs "reconnect required" distinctly instead of a
 * generic failure.
 *
 * Never returns the token to the browser — this only ever runs server-side,
 * and the caller is expected to use the token in the same request and
 * discard it.
 */
export async function getValidCanvaAccessToken(userId: string): Promise<string> {
  const supabase = await integrationAdminClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("id, status, access_token_enc, refresh_token_enc, access_token_expires_at")
    .eq("provider", CANVA_PROVIDER)
    .eq("user_id", userId)
    .maybeSingle();

  const row = data as {
    id: string;
    status: string;
    access_token_enc: unknown;
    refresh_token_enc: unknown;
    access_token_expires_at: string | null;
  } | null;

  if (!row || row.status !== "connected" || !row.access_token_enc) {
    throw new CanvaApiError("not_connected", "Canva is not connected");
  }

  const expiresAt = row.access_token_expires_at ? Date.parse(row.access_token_expires_at) : null;
  const nearExpiry = expiresAt !== null && expiresAt - Date.now() < 60_000;

  if (!nearExpiry) {
    return decryptOAuthSecret(row.access_token_enc);
  }

  if (!row.refresh_token_enc) {
    // Expired with nothing to refresh from — the creator must reconnect.
    await markCanvaError(supabase, row.id, "token_expired_no_refresh_token");
    throw new CanvaApiError("reauth_required", "Canva authorization has expired");
  }

  try {
    const refreshToken = await decryptOAuthSecret(row.refresh_token_enc);
    const tokens = await refreshCanvaToken(refreshToken);
    if (!tokens.access_token) throw new Error("no_access_token");
    await storeCanvaConnection(supabase, { rowId: row.id, ownerUserId: userId, tokens });
    return tokens.access_token;
  } catch {
    await markCanvaError(supabase, row.id, "token_refresh_failed");
    throw new CanvaApiError("reauth_required", "Canva authorization could not be refreshed");
  }
}

export type CanvaDesignThumbnail = { url: string; width: number | null; height: number | null };

export type CanvaDesignSummary = {
  id: string;
  title: string;
  thumbnail: CanvaDesignThumbnail | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function toIsoOrNull(unixSeconds: unknown): string | null {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds)) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

function mapCanvaDesign(raw: unknown): CanvaDesignSummary {
  const d = raw as {
    id?: string;
    title?: string;
    thumbnail?: { url?: string; width?: number; height?: number } | null;
    created_at?: number;
    updated_at?: number;
  };
  return {
    id: String(d.id ?? ""),
    title: typeof d.title === "string" && d.title.trim() ? d.title.trim() : "Untitled design",
    thumbnail: d.thumbnail?.url
      ? {
          url: d.thumbnail.url,
          width: d.thumbnail.width ?? null,
          height: d.thumbnail.height ?? null,
        }
      : null,
    createdAt: toIsoOrNull(d.created_at),
    updatedAt: toIsoOrNull(d.updated_at),
  };
}

/** GET /v1/designs — requires design:meta:read. Rate limited to 100/min/user by Canva. */
export async function listCanvaDesigns(
  accessToken: string,
  continuation?: string,
): Promise<{ items: CanvaDesignSummary[]; continuation?: string }> {
  const qs = continuation ? `?continuation=${encodeURIComponent(continuation)}` : "";
  const body = (await canvaApiFetch(`/designs${qs}`, accessToken)) as {
    items?: unknown[];
    continuation?: string;
  };
  return {
    items: (body.items ?? []).map(mapCanvaDesign),
    continuation: body.continuation,
  };
}

/** GET /v1/designs/{id} — requires design:meta:read. Used to re-check a design right before import. */
export async function getCanvaDesign(
  accessToken: string,
  designId: string,
): Promise<CanvaDesignSummary> {
  const body = (await canvaApiFetch(`/designs/${encodeURIComponent(designId)}`, accessToken)) as {
    design?: unknown;
  };
  if (!body.design) throw new CanvaApiError("design_unavailable", "The Canva design was not found");
  return mapCanvaDesign(body.design);
}

export type CanvaExportFormat = "png" | "jpg" | "pdf";

type CanvaExportJob = {
  id: string;
  status: "in_progress" | "success" | "failed";
  urls?: string[];
  error?: { message?: string } | null;
};

function mapExportJob(raw: unknown): CanvaExportJob {
  const j = raw as {
    id?: string;
    status?: string;
    urls?: string[];
    error?: { message?: string } | null;
  };
  return {
    id: String(j.id ?? ""),
    status: j.status === "success" || j.status === "failed" ? j.status : "in_progress",
    urls: j.urls,
    error: j.error ?? null,
  };
}

/** POST /v1/exports — requires design:content:read (per Canva Connect docs, not content:write). */
export async function createCanvaExportJob(
  accessToken: string,
  designId: string,
  format: CanvaExportFormat = "png",
): Promise<CanvaExportJob> {
  const body = (await canvaApiFetch("/exports", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ design_id: designId, format: { type: format } }),
  })) as { job?: unknown };
  if (!body.job) throw new CanvaApiError("export_failed", "Canva did not return an export job");
  return mapExportJob(body.job);
}

export async function getCanvaExportJob(
  accessToken: string,
  exportId: string,
): Promise<CanvaExportJob> {
  const body = (await canvaApiFetch(`/exports/${encodeURIComponent(exportId)}`, accessToken)) as {
    job?: unknown;
  };
  if (!body.job) throw new CanvaApiError("export_failed", "Canva did not return an export job");
  return mapExportJob(body.job);
}

const EXPORT_POLL_INTERVAL_MS = 1500;
const EXPORT_POLL_TIMEOUT_MS = 45_000;

/**
 * Creates an export job and polls it to completion. Bounded by
 * EXPORT_POLL_TIMEOUT_MS so a stuck Canva job can never hang the import
 * request forever — times out into a typed "export_timeout" error the
 * caller can show as a retryable failure, never a false success.
 */
export async function exportCanvaDesign(
  accessToken: string,
  designId: string,
  format: CanvaExportFormat = "png",
): Promise<{ url: string }> {
  const job = await createCanvaExportJob(accessToken, designId, format);
  const deadline = Date.now() + EXPORT_POLL_TIMEOUT_MS;

  let current = job;
  while (current.status === "in_progress") {
    if (Date.now() > deadline) {
      throw new CanvaApiError("export_timeout", "Canva export took too long to complete");
    }
    await new Promise((resolve) => setTimeout(resolve, EXPORT_POLL_INTERVAL_MS));
    current = await getCanvaExportJob(accessToken, job.id);
  }

  if (current.status === "failed" || !current.urls?.length) {
    throw new CanvaApiError("export_failed", current.error?.message ?? "Canva export failed");
  }

  return { url: current.urls[0]! };
}

/** GET /v1/users/me/profile — requires profile:read. Best-effort display name for the connection row. */
export async function getCanvaProfile(
  accessToken: string,
): Promise<{ displayName: string | null }> {
  try {
    const body = (await canvaApiFetch("/users/me/profile", accessToken)) as {
      display_name?: string;
    };
    return { displayName: typeof body.display_name === "string" ? body.display_name : null };
  } catch {
    return { displayName: null };
  }
}
