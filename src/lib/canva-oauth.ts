/**
 * AurumVault Canva Connect OAuth — pure, dependency-free core.
 *
 * PKCE (RFC 7636) generation and the Canva authorization URL builder live
 * here so they're unit-testable without Supabase/zod/@tanstack (none of
 * which are needed for this logic), and reused identically by the "start
 * connection" server function and its tests.
 */

export const CANVA_INTEGRATION_NAME = "AurumVaultCommerce";

/** Exactly the scopes Canva has already configured for this integration. */
export const CANVA_OAUTH_SCOPES = [
  "profile:read",
  "asset:read",
  "asset:write",
  "design:content:read",
  "design:meta:read",
] as const;

export const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
export const CANVA_REVOKE_URL = "https://api.canva.com/rest/v1/oauth/revoke";

/** How long a pending connection request (state + verifier) stays valid. */
export const OAUTH_REQUEST_TTL_MS = 10 * 60 * 1000; // 10 minutes

function base64UrlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 7636 §4.1: 43–128 chars from the unreserved character set. 64 random bytes → 86 base64url chars, comfortably in range. */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** RFC 7636 §4.2: code_challenge = BASE64URL(SHA256(code_verifier)), method S256. */
export async function deriveCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return base64UrlEncode(new Uint8Array(digest));
}

/** Separate high-entropy value from the verifier — CSRF/session-binding token, not part of PKCE. */
export function generateOAuthState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildCanvaAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(CANVA_AUTHORIZE_URL);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "s256");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", CANVA_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  return url.toString();
}
