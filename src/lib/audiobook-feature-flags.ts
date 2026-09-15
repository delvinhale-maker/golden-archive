/**
 * AurumVault Audiobook Studio — Phase 1 feature flags.
 *
 * Pure and dependency-free (no zod, no @tanstack/react-start, no Supabase) so
 * it is unit-testable and safely importable from both server and pure-logic
 * modules. Modeled on rights-passport-feature-flags.ts.
 *
 * FAIL-CLOSED BY DESIGN: every flag defaults to OFF unless the corresponding
 * environment variable is present and literally "true" or "1". A missing,
 * misspelled, empty, or unexpected value never enables anything.
 *
 * SECURITY NOTE: only the server-side (non-`VITE_`-prefixed) vars are a real
 * gate — they are never bundled into client JS. The `VITE_`-prefixed mirror is
 * read client-side only, purely to decide whether to *render* an affordance,
 * and is never trusted as an authorization boundary.
 */

export type AudiobookEnv = Record<string, string | undefined>;

function parseFlag(raw: string | undefined | null): boolean {
  return raw === "true" || raw === "1";
}

/** Master switch. When false, the entire Audiobook Studio product is disabled. */
export function isAudiobookStudioEnabled(env: AudiobookEnv): boolean {
  return parseFlag(env.AUDIOBOOK_STUDIO_ENABLED);
}

/** Live TTS provider calls. Implies the master switch. */
export function isAudiobookLiveTtsEnabled(env: AudiobookEnv): boolean {
  return isAudiobookStudioEnabled(env) && parseFlag(env.AUDIOBOOK_TTS_LIVE_ENABLED);
}

/**
 * Configured TTS provider. Defaults to "mock" — the only value permitted while
 * live TTS is disabled, so an unset or unexpected value can never reach a paid
 * provider.
 */
export function getAudiobookTtsProvider(env: AudiobookEnv): string {
  if (!isAudiobookLiveTtsEnabled(env)) return "mock";
  const raw = (env.AUDIOBOOK_TTS_PROVIDER ?? "").trim();
  return raw.length > 0 ? raw : "mock";
}

/** Client-side render gate only — never a security boundary. See file header. */
export function isAudiobookStudioEnabledClient(env: AudiobookEnv): boolean {
  return parseFlag(env.VITE_AUDIOBOOK_STUDIO_ENABLED);
}

export const AUDIOBOOK_STUDIO_DISABLED_MESSAGE =
  "Audiobook Studio is not currently available.";
export const AUDIOBOOK_LIVE_TTS_DISABLED_MESSAGE =
  "Audio generation is not currently available for Audiobook Studio.";