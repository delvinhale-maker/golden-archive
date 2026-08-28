/**
 * Server-only envelope encryption for third-party integration OAuth tokens
 * (Canva Connect, and future providers like Etsy/Printful/Stripe Connect).
 *
 * Deliberately mirrors src/lib/payout-crypto.server.ts's AES-256-GCM
 * envelope + key-rotation design exactly — same scheme, same envelope
 * shape, same rotation mechanics — but with its OWN key namespace. OAuth
 * tokens and payout bank/PayPal details are different security domains;
 * sharing one encryption key across both would mean a single compromised
 * key exposes both a creator's bank details and every connected
 * third-party account. Keeping the namespaces separate costs nothing and
 * bounds the blast radius correctly.
 *
 * KEY ROTATION (zero downtime) — same mechanics as payout-crypto.server.ts:
 *   INTEGRATION_TOKEN_ENCRYPTION_KEY_V4
 *   INTEGRATION_TOKEN_ENCRYPTION_KEY_V3
 *   INTEGRATION_TOKEN_ENCRYPTION_KEY_V2
 *   INTEGRATION_TOKEN_ENCRYPTION_KEY        (original)
 * First key present (checked newest-first) is the ACTIVE key. All others
 * stay decrypt-only.
 *
 * Stored shape: { __enc: "v1", kid?: "<hex8>", iv: "<base64>", data: "<base64>" }
 */

type EncEnvelope = { __enc: "v1"; kid?: string; iv: string; data: string };

const ENC_MARKER = "__enc";

/** Newest first — index 0 is the active (encrypting) key. */
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
    // Key id = first 4 bytes of SHA-256 of the derived key material (non-reversible).
    const idDigest = await crypto.subtle.digest("SHA-256", digest);
    entries.push({ envName, kid: toHex(new Uint8Array(idDigest).slice(0, 4)), key });
  }
  if (entries.length === 0) {
    throw new Error("INTEGRATION_TOKEN_ENCRYPTION_KEY is not configured");
  }
  keyringCache = entries;
  return entries;
}

export function isEncrypted(value: unknown): value is EncEnvelope {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Record<string, unknown>)[ENC_MARKER] === "v1" &&
    typeof (value as EncEnvelope).iv === "string" &&
    typeof (value as EncEnvelope).data === "string"
  );
}

/** Encrypts an arbitrary token payload (access token, refresh token, etc.). */
export async function encryptIntegrationTokens(
  tokens: Record<string, string>,
): Promise<EncEnvelope> {
  const ring = await buildKeyring();
  const active = ring[0]!;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(tokens));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, active.key, plaintext);
  return {
    __enc: "v1",
    kid: active.kid,
    iv: b64encode(iv),
    data: b64encode(new Uint8Array(cipher)),
  };
}

export async function decryptIntegrationTokens(stored: unknown): Promise<Record<string, string>> {
  if (stored == null) return {};
  if (!isEncrypted(stored)) {
    return typeof stored === "object" ? (stored as Record<string, string>) : {};
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
      const parsed = JSON.parse(new TextDecoder().decode(plain));
      return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to decrypt integration tokens with any configured key");
}
