/**
 * AurumVault Creator Studio™ — CS1 feature flags.
 * Pure, dependency-free (no zod, no @tanstack/react-start, no Supabase) so
 * it is directly unit-testable in this sandbox and safely importable from
 * both server and pure-logic modules. Mirrors
 * rights-passport-feature-flags.ts's established shape exactly.
 *
 * FAIL-SAFE BY DESIGN: every flag defaults to OFF (disabled) unless the
 * corresponding environment variable is present and literally "true" or
 * "1". A missing, misspelled, empty, or unexpected env var value never
 * enables anything.
 *
 * SECURITY NOTE: only the server-side (non-`VITE_`-prefixed) env vars are a
 * real gate — never bundled into client JS. A `VITE_`-prefixed mirror is
 * read separately, client-side only, purely to decide whether to *render*
 * a nav entry/UI affordance; it is never trusted as the actual
 * authorization boundary. Every server function that matters is gated by
 * the server-side check via creator-studio-feature-flags.middleware.ts,
 * never by the client-side flag alone.
 */

export type CreatorStudioEnv = Record<string, string | undefined>;

function parseFlag(raw: string | undefined | null): boolean {
  return raw === "true" || raw === "1";
}

/** Master switch. When false, the entire product (routes + server functions) is disabled. */
export function isCreatorStudioEnabled(env: CreatorStudioEnv): boolean {
  return parseFlag(env.CREATOR_STUDIO_ENABLED);
}

/** Actual video rendering (calling a rendering provider). Implies the master switch. */
export function isCreatorStudioRenderingEnabled(env: CreatorStudioEnv): boolean {
  return isCreatorStudioEnabled(env) && parseFlag(env.CREATOR_STUDIO_RENDERING_ENABLED);
}

/** Paid usage / billing for Creator Studio. Implies the master switch. */
export function isCreatorStudioBillingEnabled(env: CreatorStudioEnv): boolean {
  return isCreatorStudioEnabled(env) && parseFlag(env.CREATOR_STUDIO_BILLING_ENABLED);
}

/** Client-side render gate only — never a security boundary. See file header. */
export function isCreatorStudioEnabledClient(env: CreatorStudioEnv): boolean {
  return parseFlag(env.VITE_CREATOR_STUDIO_ENABLED);
}

export const CREATOR_STUDIO_DISABLED_MESSAGE = "Creator Studio is not currently available.";
export const CREATOR_STUDIO_RENDERING_DISABLED_MESSAGE =
  "Video rendering is not currently available in Creator Studio.";
export const CREATOR_STUDIO_BILLING_DISABLED_MESSAGE =
  "Creator Studio billing is not currently available.";
