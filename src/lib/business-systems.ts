// Merchandising layer for the "Business Systems" department.
// Reuses the existing `business_operating_systems` product category slug and
// the admin-managed `product_subcategories` rows — no parallel taxonomy.
//
// System Type names below are NOT duplicated here: they're imported from
// categories.ts's SUBCATEGORIES map, which is also the static fallback
// useSubcategoryNames() (src/lib/subcategories.ts) serves when a category
// has no managed product_subcategories rows yet. This file only adds the
// chip/blurb copy for each canonical name — one list of names, one place.

import { SUBCATEGORIES } from "@/lib/categories";

export const BUSINESS_SYSTEMS_SLUG = "business_operating_systems";
export const BUSINESS_SYSTEMS_LABEL = "Business Systems";
export const BUSINESS_SYSTEMS_TAGLINE =
  "Ready-to-Use Digital Systems for Modern Business";
export const BUSINESS_SYSTEMS_POSITIONING =
  "Not just information. Not just prompts. Systems you can actually put to work.";

export type BusinessSystemSub = {
  /** Filter chip label — same as `name` for Business Systems System Types. */
  filter: string;
  /** Subcategory name stored on products (product_subcategories.name). */
  name: string;
  blurb: string;
};

/** Chip copy for each canonical System Type. Keyed by the exact stored name. */
const SYSTEM_TYPE_BLURBS: Record<string, string> = {
  "Interactive Decision Tools":
    "Interactive tools designed to help users compare options, evaluate decisions, and organize important information.",
  "Complete Business Systems":
    "Full, ready-to-use systems combining workflows, prompts, dashboards, and implementation plans for a real business function.",
  "Live Dashboards & Calculators":
    "Tools that automatically calculate metrics, scores, or financial outputs from the buyer's own inputs.",
  "Operating Systems": "End-to-end operating systems for running a business function day to day.",
  "Assessment & Scoring Tools":
    "Guided assessments that score, rank, or evaluate the buyer's situation.",
};

export const BUSINESS_SYSTEM_SUBS: BusinessSystemSub[] = (
  SUBCATEGORIES[BUSINESS_SYSTEMS_SLUG] ?? []
).map((name) => ({
  filter: name,
  name,
  blurb: SYSTEM_TYPE_BLURBS[name] ?? "",
}));

export const BUSINESS_SYSTEM_SUB_NAMES = BUSINESS_SYSTEM_SUBS.map((s) => s.name);

export const BUSINESS_SYSTEMS_FLAGSHIP = {
  title: "The AI Small Business Operating System",
  subtitle:
    "A Ready-to-Use System for Marketing, Sales, Customer Service, Operations & Executive Planning",
  subcategory: "Operating Systems",
  highlights: [
    "Business Brain",
    "65-Prompt Master Vault",
    "Workflows & Dashboards",
    "Human Approval & Governance",
    "30-Day Implementation Plan",
  ],
  /** Matched case-insensitively against live listing titles. */
  titleMatch: "ai small business operating system",
} as const;

/** Optional premium card labels. Kept short — never stack more than two. */
export const BUSINESS_SYSTEM_BADGES = [
  "Complete Business System",
  "Interactive System",
  "Includes Prompt Vault",
  "Includes Dashboards",
  "30-Day Implementation",
] as const;

export function isBusinessSystem(categorySlugOrLabel?: string | null): boolean {
  const v = (categorySlugOrLabel ?? "").toLowerCase();
  return v === BUSINESS_SYSTEMS_SLUG || v === BUSINESS_SYSTEMS_LABEL.toLowerCase();
}
