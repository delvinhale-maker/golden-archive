/**
 * AurumVault Insider — shared, client-safe constants and helpers for the
 * newsletter/audience system. This layer intentionally reuses the existing
 * `subscribers` table and email queue; it does not introduce a second email
 * platform.
 */

export type AudienceType = "GENERAL" | "CREATOR" | "BUSINESS_TOOL";

export const INSIDER_NAME = "AurumVault Insider";

export const INSIDER_TAGLINE =
  "Useful digital tools, creator opportunities, marketplace releases, and practical ideas to help you build, create, and grow.";

export const INSIDER_CONSENT_TEXT =
  "By subscribing, you agree to receive AurumVault Insider emails. You can unsubscribe at any time.";

export const CONSENT_VERSION = "insider-v1";

/** Where the signup happened — used for segmentation and reporting. */
export type InsiderSource =
  | "homepage"
  | "footer"
  | "academy"
  | "creator"
  | "qr"
  | "insider_page"
  | "other";

const AUDIENCE_BY_SOURCE: Record<InsiderSource, AudienceType> = {
  homepage: "GENERAL",
  footer: "GENERAL",
  academy: "GENERAL",
  insider_page: "GENERAL",
  other: "GENERAL",
  creator: "CREATOR",
  qr: "BUSINESS_TOOL",
};

/** Infer the audience segment from the signup surface. */
export function audienceForSource(source: string): AudienceType {
  return AUDIENCE_BY_SOURCE[source as InsiderSource] ?? "GENERAL";
}

export function isValidAudience(value: unknown): value is AudienceType {
  return value === "GENERAL" || value === "CREATOR" || value === "BUSINESS_TOOL";
}

export const AUDIENCE_LABEL: Record<AudienceType, string> = {
  GENERAL: "General",
  CREATOR: "Creator",
  BUSINESS_TOOL: "Business tools",
};

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 255;
}

export function insiderSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
