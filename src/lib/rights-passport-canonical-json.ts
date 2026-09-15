/**
 * AurumVault Digital Rights Passport Generator — Round 4 canonical
 * serialization and content-hashing.
 *
 * Pure, dependency-free (no zod, no @supabase/supabase-js) — matching the
 * established pattern for logic modules in this codebase. crypto.subtle is
 * a Web Crypto global (available in the browser, Node 18+, and Bun), not an
 * npm import, so using it here doesn't break that convention.
 *
 * SAFETY: canonicalStringify is what makes the published snapshot's
 * content_hash meaningful — the same logical payload must always produce
 * the same bytes to hash, regardless of the order fields happened to be
 * assembled in. Object keys are sorted recursively; array ORDER is
 * preserved as meaningful data (e.g. an assets list's order is not
 * canonicalized away).
 */

export function canonicalStringify(value: unknown): string {
  return stringifyCanonical(value);
}

function stringifyCanonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "null";
    return JSON.stringify(value);
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stringifyCanonical(v)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const entries = keys.map(
      (k) => `${JSON.stringify(k)}:${stringifyCanonical((value as Record<string, unknown>)[k])}`,
    );
    return `{${entries.join(",")}}`;
  }
  return "null";
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 of the canonical serialization, as a lowercase hex string (64 chars). */
export async function hashCanonicalPayload(value: unknown): Promise<string> {
  const canonical = canonicalStringify(value);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(digest);
}

/** First N hex characters of a full content hash — a short, human-shareable "integrity ID," never presented as blockchain/copyright proof. */
export function shortIntegrityId(fullHash: string, length = 16): string {
  return fullHash.slice(0, length);
}
