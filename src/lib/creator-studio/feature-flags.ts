/**
 * Fail-closed feature flags for AurumVault Creator Studio(tm).
 *
 * Every flag defaults to OFF: an absent, empty, or misspelled env var is
 * treated as disabled rather than enabled. The three flags are also
 * hierarchical -- rendering and paid plans only take effect when the master
 * switch is on -- so a partial/inconsistent env configuration always fails
 * toward the safer (less exposed) state, never the more exposed one.
 *
 * Recommended staging rollout sequence (see docs/creator-studio/README.md):
 *   1. CREATOR_STUDIO_ENABLED=true, the rest false  -- wizard + library only.
 *   2. + CREATOR_STUDIO_RENDERING_ENABLED=true       -- real provider renders.
 *   3. + CREATOR_STUDIO_PAID_PLANS_ENABLED=true       -- Stripe entitlements.
 */

export type CreatorStudioEnv = Record<string, string | undefined>;

export function parseFlag(raw: string | undefined): boolean {
  return raw === "true" || raw === "1";
}

/** Master switch. Every other Creator Studio flag implies this one. */
export function isCreatorStudioEnabled(env: CreatorStudioEnv): boolean {
  return parseFlag(env.CREATOR_STUDIO_ENABLED);
}

/** Gates real Shotstack submission. Implies isCreatorStudioEnabled. */
export function isCreatorStudioRenderingEnabled(env: CreatorStudioEnv): boolean {
  return isCreatorStudioEnabled(env) && parseFlag(env.CREATOR_STUDIO_RENDERING_ENABLED);
}

/** Gates Stripe checkout (subscriptions + extra credits). Implies the master switch. */
export function isCreatorStudioPaidPlansEnabled(env: CreatorStudioEnv): boolean {
  return isCreatorStudioEnabled(env) && parseFlag(env.CREATOR_STUDIO_PAID_PLANS_ENABLED);
}

/**
 * Client-side mirror of the master switch only, reading the VITE_-prefixed
 * variable. This is NEVER a security boundary -- it exists purely so the UI
 * can render/hide the Creator Studio nav entry without a round trip. Every
 * server function re-checks the real flag independently via the middleware
 * below, regardless of what this returns.
 */
export function isCreatorStudioEnabledClient(env: CreatorStudioEnv): boolean {
  return parseFlag(env.VITE_CREATOR_STUDIO_ENABLED);
}

export const CREATOR_STUDIO_DISABLED_MESSAGE = "Creator Studio isn't available right now.";
export const CREATOR_STUDIO_RENDERING_DISABLED_MESSAGE =
  "Video creation isn't turned on for your account yet.";
export const CREATOR_STUDIO_PAID_PLANS_DISABLED_MESSAGE =
  "Plan upgrades aren't available right now.";
