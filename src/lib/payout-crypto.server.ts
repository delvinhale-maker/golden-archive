/**
 * Server-only envelope encryption for creator payout details.
 *
 * Bank/routing numbers and PayPal emails are encrypted with AES-256-GCM before
 * they touch the database. Rows written before encryption existed stay readable
 * (plaintext passthrough on decrypt).
 *
 * KEY ROTATION (zero downtime)
 * ----------------------------
 * The keyring is read from env vars, newest first:
 *   PAYOUT_DETAILS_ENCRYPTION_KEY_V4
 *   PAYOUT_DETAILS_ENCRYPTION_KEY_V3
 *   PAYOUT_DETAILS_ENCRYPTION_KEY_V2
 *   PAYOUT_DETAILS_ENCRYPTION_KEY        (original)
 *
 * The first key present is the ACTIVE key: everything new is encrypted with it.
 * All other keys stay decrypt-only, so rows encrypted with an older key keep
 * working until they are re-encrypted. Each envelope records a short key id
 * (`kid`) so decryption picks the right key directly instead of guessing.
 *
 * Rotating = add a new higher-numbered secret, then run the admin re-encrypt
 * job (src/lib/payout-key-rotation.functions.ts). Once the job reports zero
 * stale rows, the retired secret can be deleted.
 *
 * Stored shape:  { __enc: "v1", kid?: "<hex8>", iv: "<base64>", data: "<base64>" }
 */

type EncEnvelope = { __enc: "v1"; kid?: string; iv: string; data: string };

const ENC_MARKER = "__enc";

/** Newest first — index 0 is the active (encrypting) key. */
const KEY_ENV_NAMES = [
  "PAYOUT_DETAILS_ENCRYPTION_KEY_V4",
  "PAYOUT_DETAILS_ENCRYPTION_KEY_V3",
  "PAYOUT_DETAILS_ENCRYPTION_KEY_V2",
  "PAYOUT_DETAILS_ENCRYPTION_KEY",
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
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(secret),
    );
    const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
    // Key id = first 4 bytes of SHA-256 of the derived key material (non-reversible).
    const idDigest = await crypto.subtle.digest("SHA-256", digest);
    entries.push({ envName, kid: toHex(new Uint8Array(idDigest).slice(0, 4)), key });
  }
  if (entries.length === 0) {
    throw new Error("PAYOUT_DETAILS_ENCRYPTION_KEY is not configured");
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

/** Active key id + which env slots are loaded (no secret material). */
export async function getKeyringStatus(): Promise<{
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

/** True when the stored value is missing, plaintext, or sealed with a retired key. */
export async function needsReEncryption(stored: unknown): Promise<boolean> {
  if (stored == null) return false;
  const ring = await buildKeyring();
  const activeKid = ring[0]!.kid;
  if (!isEncrypted(stored)) return typeof stored === "object";
  return stored.kid !== activeKid;
}

export async function encryptPayoutDetails(
  details: Record<string, string>,
): Promise<EncEnvelope> {
  const ring = await buildKeyring();
  const active = ring[0]!;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(details));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    active.key,
    plaintext,
  );
  return {
    __enc: "v1",
    kid: active.kid,
    iv: b64encode(iv),
    data: b64encode(new Uint8Array(cipher)),
  };
}

export async function decryptPayoutDetails(
  stored: unknown,
): Promise<Record<string, string>> {
  if (stored == null) return {};
  if (!isEncrypted(stored)) {
    // Legacy plaintext row.
    return typeof stored === "object" ? (stored as Record<string, string>) : {};
  }
  const ring = await buildKeyring();
  // Prefer the key the envelope names; fall back to trying every key so rows
  // written before `kid` existed (or during a partial rotation) still open.
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
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, string>)
        : {};
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to decrypt payout details with any configured key");
}

/** Best-effort decrypt that never throws — used for admin lists. */
export async function safeDecryptPayoutDetails(
  stored: unknown,
): Promise<Record<string, string>> {
  try {
    return await decryptPayoutDetails(stored);
  } catch {
    return { error: "Unable to decrypt payout details" };
  }
}
