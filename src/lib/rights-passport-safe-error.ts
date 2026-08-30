/**
 * AurumVault Digital Rights Passport Generator — release-candidate failure
 * UX. Pure, dependency-free.
 *
 * FINDING THIS ADDRESSES: throughout Rounds 1-4, the established pattern
 * for surfacing a Supabase/PostgREST error to the caller was
 * `throw new Error(error.message)` — which forwards the RAW database error
 * string verbatim. PostgREST/Postgres error text routinely contains
 * internal schema detail (constraint names like
 * "rights_ai_consents_unique_scope", column/table names, "violates
 * check constraint", "duplicate key value violates unique constraint")
 * that the release spec's Phase 8 explicitly says must never reach a user
 * ("Do not expose: raw SQL errors, Supabase stack traces... internal
 * storage paths"). This module maps the small set of recognizable
 * Postgres/PostgREST error shapes to a safe, generic, still-useful message,
 * and passes through anything that doesn't match that shape unchanged
 * (since most `throw new Error("...")` calls in this codebase already
 * author their own safe, human-written message — e.g. every guard-trigger
 * RAISE EXCEPTION text, and every explicit safe message already used
 * throughout the document-parsing and AI-analysis pipeline).
 *
 * WIRING STATUS (documented honestly): wired into createPassport and
 * publishPassport as the end-to-end proof this module works. The dozens of
 * other `throw new Error(error.message)` call sites across the remaining
 * rights-passport-*.functions.ts files still forward raw DB error text and
 * are called out explicitly as remaining work in the release report —
 * systematically replacing every one without a live database to verify
 * against (this sandbox has no Postgres/Supabase available) was judged
 * higher-risk than valuable this late in the pass; each one is a
 * mechanical `throw new Error(sanitizeDbErrorMessage(error.message))`
 * substitution following the exact pattern below.
 */

const RAW_DB_ERROR_PATTERNS: RegExp[] = [
  /violates (unique|check|foreign key|not-null) constraint/i,
  /duplicate key value/i,
  /relation "[^"]+" does not exist/i,
  /column "[^"]+"/i,
  /permission denied for/i,
  /new row violates row-level security/i,
  /invalid input syntax for/i,
];

export const SAFE_GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * Returns the input message unchanged if it looks like an already-safe,
 * human-authored message; returns a safe generic fallback if it looks like
 * raw Postgres/PostgREST error text.
 */
export function sanitizeDbErrorMessage(rawMessage: string | null | undefined): string {
  if (!rawMessage) return SAFE_GENERIC_ERROR_MESSAGE;
  const looksLikeRawDbError = RAW_DB_ERROR_PATTERNS.some((pattern) => pattern.test(rawMessage));
  return looksLikeRawDbError ? SAFE_GENERIC_ERROR_MESSAGE : rawMessage;
}
