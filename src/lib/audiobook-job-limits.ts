/**
 * AurumVault Audiobook Studio — Phase 5 launch-gate cost guard.
 *
 * Pure and dependency-free. A single chapter can legitimately be very long, and
 * a live provider is billed per character across every segment of that chapter.
 * For a controlled beta we therefore cap the total billable characters a single
 * narration job may request from a PAID provider. The mock provider is free and
 * network-free, so it is intentionally uncapped.
 *
 * This is a code-only guard: no schema, no quota table, no billing product.
 */

/** Conservative beta ceiling per paid narration job (~1 hour of narration). */
export const MAX_LIVE_JOB_CHARACTERS = 60_000;

export type LiveJobCapResult = { allowed: boolean; message?: string };

export function checkLiveJobCharacterCap(
  characters: number,
  isMock: boolean,
  maxCharacters: number = MAX_LIVE_JOB_CHARACTERS,
): LiveJobCapResult {
  if (isMock) return { allowed: true };
  if (!Number.isFinite(characters) || characters <= 0) {
    return { allowed: false, message: "This chapter has no narratable text." };
  }
  if (characters > maxCharacters) {
    return {
      allowed: false,
      message: `This chapter is ${characters.toLocaleString()} characters, above the ${maxCharacters.toLocaleString()}-character limit for a single narration request. Split it into shorter chapters and try again.`,
    };
  }
  return { allowed: true };
}