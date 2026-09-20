/**
 * AurumVault Audiobook Studio — Phase 2 deterministic idempotency keys.
 *
 * The Phase 1 schema enforces UNIQUE (owner_id, idempotency_key) on
 * audiobook_generation_jobs. This helper is the only place a key is built, so
 * "same logical narration request" always collapses to the SAME job row and a
 * paid provider can never be billed twice for identical work.
 *
 * Pure and dependency-free. Uses Web Crypto (available in the Worker runtime,
 * the browser and Vitest) with a deterministic non-crypto fallback so a key is
 * always producible.
 */

export type NarrationRequestIdentity = {
  projectId: string;
  chapterId: string | null;
  chapterVersionId: string | null;
  voiceConfigId: string | null;
  provider: string;
  model: string | null;
  /** Stable fingerprint of the segmentation plan (see audiobook-segment.ts). */
  segmentationFingerprint: string;
  characters: number;
};

/** Canonical, order-stable string form of a narration request. */
export function canonicalNarrationString(identity: NarrationRequestIdentity): string {
  return [
    `project=${identity.projectId}`,
    `chapter=${identity.chapterId ?? "-"}`,
    `version=${identity.chapterVersionId ?? "-"}`,
    `voice=${identity.voiceConfigId ?? "-"}`,
    `provider=${identity.provider}`,
    `model=${identity.model ?? "-"}`,
    `chars=${identity.characters}`,
    `segments=${identity.segmentationFingerprint}`,
  ].join(";");
}

function fallbackHash(input: string): string {
  // FNV-1a 64-bit-ish, expressed as two 32-bit halves. Deterministic.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + Math.imul(c + i, 0x85ebca6b)) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) return fallbackHash(typeof input === "string" ? input : String(bytes.byteLength));
  const digest = await subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** `ab1_<sha256>` — prefixed so key provenance stays readable in the DB. */
export async function narrationIdempotencyKey(
  identity: NarrationRequestIdentity,
): Promise<string> {
  return `ab1_${await sha256Hex(canonicalNarrationString(identity))}`;
}