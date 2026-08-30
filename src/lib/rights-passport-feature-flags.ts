/**
 * AurumVault Digital Rights Passport Generator — release-candidate feature
 * flags. Pure, dependency-free (no zod, no @tanstack/react-start, no
 * Supabase) so it is directly unit-testable in this sandbox and safely
 * importable from both server and pure-logic modules.
 *
 * FAIL-SAFE BY DESIGN: every flag defaults to OFF (disabled) unless the
 * corresponding environment variable is present and literally "true" or
 * "1". A missing, misspelled, empty, or unexpected env var value never
 * enables anything — this is what "absent configuration must fail safe"
 * means concretely here. There is no rollout-state enum stored anywhere
 * (OFF/INTERNAL/BETA/PUBLIC are a conceptual rollout narrative for the
 * operator sequence in the release report, not a value this module reads) —
 * operationally, INTERNAL/BETA/PUBLIC are all "the flag is true," and the
 * distinction between them is enforced by who has access to the
 * environment where that env var is set (see the deployment sequence in
 * the release report), not by application code.
 *
 * SECURITY NOTE: only the server-side (non-`VITE_`-prefixed) env vars are a
 * real gate — they are never bundled into client JS. A `VITE_`-prefixed
 * mirror is read separately, client-side only, purely to decide whether to
 * *render* a nav entry/UI affordance; it is never trusted as the actual
 * authorization boundary. Every server function that matters is gated by
 * the server-side check via rights-passport-feature-flags.middleware.ts,
 * never by the client-side flag alone.
 */

export type RightsPassportEnv = Record<string, string | undefined>;

function parseFlag(raw: string | undefined | null): boolean {
  return raw === "true" || raw === "1";
}

/** Master switch. When false, the entire product is disabled. */
export function isRightsPassportEnabled(env: RightsPassportEnv): boolean {
  return parseFlag(env.DIGITAL_RIGHTS_PASSPORT_ENABLED);
}

/** AI document analysis (Upload & Analyze). Implies the master switch. */
export function isRightsPassportAiEnabled(env: RightsPassportEnv): boolean {
  return isRightsPassportEnabled(env) && parseFlag(env.DIGITAL_RIGHTS_PASSPORT_AI_ENABLED);
}

/** Publish / revoke / the public Rights Card route. Implies the master switch. */
export function isRightsPassportPublicPublishEnabled(env: RightsPassportEnv): boolean {
  return (
    isRightsPassportEnabled(env) && parseFlag(env.DIGITAL_RIGHTS_PASSPORT_PUBLIC_PUBLISH_ENABLED)
  );
}

/** Client-side render gate only — never a security boundary. See file header. */
export function isRightsPassportEnabledClient(env: RightsPassportEnv): boolean {
  return parseFlag(env.VITE_DIGITAL_RIGHTS_PASSPORT_ENABLED);
}

export const RIGHTS_PASSPORT_DISABLED_MESSAGE =
  "Digital Rights Passport is not currently available.";
export const RIGHTS_PASSPORT_AI_DISABLED_MESSAGE =
  "AI document analysis is not currently available for Digital Rights Passport.";
export const RIGHTS_PASSPORT_PUBLISH_DISABLED_MESSAGE =
  "Public publishing is not currently available for Digital Rights Passport.";
