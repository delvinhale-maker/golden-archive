/**
 * Server-only envelope encryption for creator payout details.
 *
 * Bank/routing numbers and PayPal emails are encrypted with AES-256-GCM before
 * they touch the database, using PAYOUT_DETAILS_ENCRYPTION_KEY. Rows written
 * before this change stay readable (plaintext passthrough on decrypt).
 *
 * Stored shape:  { __enc: "v1", iv: "<base64>", data: "<base64>" }
 */

type EncEnvelope = { __enc: "v1"; iv: string; data: string };

const ENC_MARKER = "__enc";

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(value: string): Uint8Array {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env["PAYOUT_DETAILS_ENCRYPTION_KEY"];
  if (!secret) throw new Error("PAYOUT_DETAILS_ENCRYPTION_KEY is not configured");
  // Derive a stable 256-bit key from the secret string.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
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

export async function encryptPayoutDetails(
  details: Record<string, string>,
): Promise<EncEnvelope> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(details));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { __enc: "v1", iv: b64encode(iv), data: b64encode(new Uint8Array(cipher)) };
}

export async function decryptPayoutDetails(
  stored: unknown,
): Promise<Record<string, string>> {
  if (stored == null) return {};
  if (!isEncrypted(stored)) {
    // Legacy plaintext row.
    return typeof stored === "object" ? (stored as Record<string, string>) : {};
  }
  const key = await getKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(stored.iv) },
    key,
    b64decode(stored.data),
  );
  const parsed = JSON.parse(new TextDecoder().decode(plain));
  return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
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
