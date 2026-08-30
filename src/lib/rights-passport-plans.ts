/**
 * AurumVault Digital Rights Passport Generator — release-candidate
 * entitlement/plan configuration. Pure, dependency-free (no zod, no
 * Supabase) so it is directly unit-testable and is the single source of
 * truth for what each plan tier allows.
 *
 * SEARCH-FIRST NOTE: this codebase has no existing subscription/entitlement
 * table or "tier" concept anywhere (its Stripe integration is a one-time
 * marketplace-checkout system — see stripe.server.ts/payments.functions.ts
 * — not a billing-tier system), so there is no existing pattern to extend
 * here. What IS reused is the shape of `public.has_role()`: a small,
 * owner-scoped lookup with a safe default when no row exists. See
 * docs/proposed-migrations/20260830190000_rights_passport_entitlements.sql
 * for the table this module's server-side caller reads from.
 *
 * THESE LIMITS ARE NOT FINAL. No price is defined anywhere in this file or
 * anywhere in the Rights Passport codebase — only relative capability
 * limits, which the business can tune freely before or after launch without
 * touching this module's shape. Treat every number below as a placeholder
 * default, not a commercial decision.
 */

export type RightsPassportPlan = "FREE_PREVIEW" | "PERSONAL" | "PROFESSIONAL" | "BUSINESS";

export const RIGHTS_PASSPORT_PLANS: RightsPassportPlan[] = [
  "FREE_PREVIEW",
  "PERSONAL",
  "PROFESSIONAL",
  "BUSINESS",
];

/** The plan assumed for any user with no entitlement row — the most restrictive tier, by design (fail-safe). */
export const DEFAULT_RIGHTS_PASSPORT_PLAN: RightsPassportPlan = "FREE_PREVIEW";

export type RightsPassportCapability =
  | "ACTIVE_PASSPORTS"
  | "DOCUMENT_UPLOADS_PER_PASSPORT"
  | "AI_ANALYSES_PER_MONTH"
  | "STORAGE_MB"
  | "PUBLIC_PUBLISH"
  | "PDF_EXPORTS"
  | "JSON_EXPORTS"
  | "PRIVATE_OWNER_EXPORTS"
  | "VERSION_HISTORY_DEPTH"
  | "ADVANCED_CONFLICT_ANALYSIS"
  | "MANAGED_IDENTITIES";

/**
 * A numeric limit, `true` (unlimited/allowed), or `false` (never allowed on
 * this plan regardless of any count).
 */
export type CapabilityLimit = number | boolean;

export type PlanCapabilityLimits = Record<RightsPassportCapability, CapabilityLimit>;

/**
 * Placeholder capability matrix — tune freely. Every capability is listed
 * for every plan explicitly (no implicit fallback), so adding a plan means
 * a compile error here until every capability is decided for it.
 */
export const PLAN_CAPABILITY_LIMITS: Record<RightsPassportPlan, PlanCapabilityLimits> = {
  FREE_PREVIEW: {
    ACTIVE_PASSPORTS: 1,
    DOCUMENT_UPLOADS_PER_PASSPORT: 1,
    AI_ANALYSES_PER_MONTH: 1,
    STORAGE_MB: 25,
    PUBLIC_PUBLISH: false,
    PDF_EXPORTS: false,
    JSON_EXPORTS: false,
    PRIVATE_OWNER_EXPORTS: false,
    VERSION_HISTORY_DEPTH: 1,
    ADVANCED_CONFLICT_ANALYSIS: false,
    MANAGED_IDENTITIES: 1,
  },
  PERSONAL: {
    ACTIVE_PASSPORTS: 1,
    DOCUMENT_UPLOADS_PER_PASSPORT: 10,
    AI_ANALYSES_PER_MONTH: 10,
    STORAGE_MB: 250,
    PUBLIC_PUBLISH: true,
    PDF_EXPORTS: true,
    JSON_EXPORTS: true,
    PRIVATE_OWNER_EXPORTS: true,
    VERSION_HISTORY_DEPTH: 5,
    ADVANCED_CONFLICT_ANALYSIS: false,
    MANAGED_IDENTITIES: 1,
  },
  PROFESSIONAL: {
    ACTIVE_PASSPORTS: 3,
    DOCUMENT_UPLOADS_PER_PASSPORT: 50,
    AI_ANALYSES_PER_MONTH: 50,
    STORAGE_MB: 2000,
    PUBLIC_PUBLISH: true,
    PDF_EXPORTS: true,
    JSON_EXPORTS: true,
    PRIVATE_OWNER_EXPORTS: true,
    VERSION_HISTORY_DEPTH: 25,
    ADVANCED_CONFLICT_ANALYSIS: true,
    MANAGED_IDENTITIES: 3,
  },
  BUSINESS: {
    ACTIVE_PASSPORTS: 25,
    DOCUMENT_UPLOADS_PER_PASSPORT: 200,
    AI_ANALYSES_PER_MONTH: 500,
    STORAGE_MB: 20000,
    PUBLIC_PUBLISH: true,
    PDF_EXPORTS: true,
    JSON_EXPORTS: true,
    PRIVATE_OWNER_EXPORTS: true,
    VERSION_HISTORY_DEPTH: 100,
    ADVANCED_CONFLICT_ANALYSIS: true,
    MANAGED_IDENTITIES: 25,
  },
};

export type CapabilityCheckResult =
  | { allowed: true; limit: CapabilityLimit }
  | { allowed: false; limit: CapabilityLimit; reason: "PLAN_DOES_NOT_INCLUDE" | "LIMIT_REACHED" };

/**
 * Pure decision function — never touches the network. `currentUsage` is
 * required for numeric-limit capabilities and ignored for boolean ones.
 */
export function checkRightsPassportCapability(
  plan: RightsPassportPlan,
  capability: RightsPassportCapability,
  currentUsage = 0,
): CapabilityCheckResult {
  const limit = PLAN_CAPABILITY_LIMITS[plan][capability];

  if (typeof limit === "boolean") {
    return limit
      ? { allowed: true, limit }
      : { allowed: false, limit, reason: "PLAN_DOES_NOT_INCLUDE" };
  }

  if (currentUsage < limit) {
    return { allowed: true, limit };
  }
  return { allowed: false, limit, reason: "LIMIT_REACHED" };
}

export const RIGHTS_PASSPORT_QUOTA_MESSAGE: Record<RightsPassportCapability, string> = {
  ACTIVE_PASSPORTS: "You've reached the active passport limit for your plan.",
  DOCUMENT_UPLOADS_PER_PASSPORT:
    "You've reached the document upload limit for this passport on your plan.",
  AI_ANALYSES_PER_MONTH: "You've reached your monthly AI analysis limit.",
  STORAGE_MB: "You've reached your storage limit.",
  PUBLIC_PUBLISH: "Public publishing isn't included in your current plan.",
  PDF_EXPORTS: "PDF export isn't included in your current plan.",
  JSON_EXPORTS: "JSON export isn't included in your current plan.",
  PRIVATE_OWNER_EXPORTS: "Private owner exports aren't included in your current plan.",
  VERSION_HISTORY_DEPTH: "You've reached the version history depth for your plan.",
  ADVANCED_CONFLICT_ANALYSIS: "Advanced conflict analysis isn't included in your current plan.",
  MANAGED_IDENTITIES: "You've reached the managed identity limit for your plan.",
};
