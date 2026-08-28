/**
 * Server-only envelope encryption for third-party OAuth credentials.
 *
 * Deliberately mirrors the established payout-details pattern
 * (src/lib/payout-crypto.server.ts): AES-256-GCM, a newest-first keyring read
 * from env, a short non-reversible key id (`kid`) recorded in each envelope, and
 * decrypt-only fallback across retired keys so rotation needs no downtime.
 *
 * Keyring (newest first — index 0 is the ACTIVE encrypting key):
 *   INTEGRATION_TOKEN_ENCRYPTION_KEY_V4
 *   INTEGRATION_TOKEN_ENCRYPTION_KEY_V3
 *   INTEGRATION_TOKEN_ENCRYPTION_KEY_V2
 *   INTEGRATION_TOKEN_ENCRYPTION_KEY        (original)
 *
 * Stored shape: { __enc: "v1", kid: "<hex8>", iv: "<base64>", data: "<base64>" }
 */

export type OAuthEnvelope = {
  __enc: "v1";
  kid?: string;
  iv: string;
  data: string;
};

const KEY_ENV_NAMES = [
  "INTEGRATION_TOKEN_ENCRYPTION_KEY_V4",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY_V3",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY_V2",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY",
] as const;

type KeyringEntry = { envName: string; kid: string; key: CryptoKey };

let keyringCache: KeyringEntry[] | null = null;

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildKeyring(): Promise<KeyringEntry[]> {
  if (keyringCache) return keyringCache;
  const entries: KeyringEntry[] = [];
  for (const envName of KEY_ENV_NAMES) {
    const secret = process.env[envName];
    if (!secret) continue;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
    const idDigest = await crypto.subtle.digest("SHA-256", digest);
    entries.push({ envName, kid: toHex(new Uint8Array(idDigest).slice(0, 4)), key });
  }
  if (entries.length === 0) {
    throw new Error("INTEGRATION_TOKEN_ENCRYPTION_KEY is not configured");
  }
  keyringCache = entries;
  return entries;
}

/** Test seam: drop the cached keyring after changing env vars. */
export function resetOAuthKeyring(): void {
  keyringCache = null;
}

export function isOAuthEnvelope(value: unknown): value is OAuthEnvelope {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Record<string, unknown>)["__enc"] === "v1" &&
    typeof (value as OAuthEnvelope).iv === "string" &&
    typeof (value as OAuthEnvelope).data === "string"
  );
}

export async function encryptOAuthSecret(plaintext: string): Promise<OAuthEnvelope> {
  const ring = await buildKeyring();
  const active = ring[0]!;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    active.key,
    new TextEncoder().encode(plaintext),
  );
  return {
    __enc: "v1",
    kid: active.kid,
    iv: b64encode(iv),
    data: b64encode(new Uint8Array(cipher)),
  };
}

export async function decryptOAuthSecret(stored: unknown): Promise<string> {
  if (!isOAuthEnvelope(stored)) {
    throw new Error("Stored OAuth secret is not a valid envelope");
  }
  const ring = await buildKeyring();
  const ordered = stored.kid
    ? [...ring.filter((e) => e.kid === stored.kid), ...ring.filter((e) => e.kid !== stored.kid)]
    : ring;

  let lastError: unknown = null;
  for (const entry of ordered) {
    try {
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64decode(stored.iv) },
        entry.key,
        b64decode(stored.data),
      );
      return new TextDecoder().decode(plain);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to decrypt OAuth secret with any configured key");
}

/** Active key id + loaded slots (no secret material) — for admin diagnostics. */
export async function getOAuthKeyringStatus(): Promise<{
  active_kid: string;
  active_env: string;
  decrypt_only: { env: string; kid: string }[];
}> {
  const ring = await buildKeyring();
  const [active, ...rest] = ring as [KeyringEntry, ...KeyringEntry[]];
  return {
    active_kid: active.kid,
    active_env: active.envName,
    decrypt_only: rest.map((e) => ({ env: e.envName, kid: e.kid })),
  };
}
