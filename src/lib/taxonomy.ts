// AurumVault taxonomy — SINGLE SOURCE OF TRUTH.
//
// Three logical layers, never sharing a label:
//   LEVEL 1  Category         where shoppers find the product   (categories.ts / product_category enum)
//   LEVEL 2  Subcategory /    what business function it serves   (product_subcategories rows)
//            System Type
//   LEVEL 3  Product Type     how the customer uses it          (this file, marketplace_products.product_type)
//
// Delivery Contents is NOT taxonomy — it describes the files a buyer receives.

import { CATEGORIES, getCategoryDef, SUBCATEGORIES } from "@/lib/categories";
import { BUSINESS_SYSTEMS_SLUG } from "@/lib/business-systems";

/* ------------------------------------------------------------------ *
 * LEVEL 3 — Product Type
 * ------------------------------------------------------------------ */

export type ProductTypeSlug =
  | "complete_digital_system"
  | "interactive_decision_tool"
  | "live_dashboard_calculator"
  | "interactive_pdf"
  | "template_workbook"
  | "ebook"
  | "planner_journal"
  | "prompt_system"
  | "educational_resource"
  | "audio"
  | "creator_production_system";

export type ProductTypeDef = {
  slug: ProductTypeSlug;
  /** Official label. Never varied in UI copy. */
  label: string;
  /** One-line picker/card description. */
  blurb: string;
  /** Short filter-chip label. */
  filter: string;
};

export const PRODUCT_TYPE_DEFS: ProductTypeDef[] = [
  {
    slug: "complete_digital_system",
    label: "Complete Digital System",
    blurb: "Multi-file system with tools, guides, dashboards or supporting assets",
    filter: "Complete Digital Systems",
  },
  {
    slug: "interactive_decision_tool",
    label: "Interactive Decision Tool",
    blurb: "Guides the buyer through inputs, scoring and decisions",
    filter: "Interactive Decision Tools",
  },
  {
    slug: "live_dashboard_calculator",
    label: "Live Dashboard / Calculator",
    blurb: "Automatically calculates metrics, scores or financial outputs",
    filter: "Live Dashboards & Calculators",
  },
  {
    slug: "interactive_pdf",
    label: "Interactive PDF",
    blurb: "Fillable, clickable or calculation-enabled PDF",
    filter: "Interactive PDFs",
  },
  {
    slug: "template_workbook",
    label: "Template / Workbook",
    blurb: "DOCX, XLSX, PDF or other reusable template",
    filter: "Templates & Workbooks",
  },
  {
    slug: "ebook",
    label: "eBook",
    blurb: "PDF or EPUB publication",
    filter: "eBooks",
  },
  {
    slug: "planner_journal",
    label: "Planner / Journal",
    blurb: "Digital planning or journaling resource",
    filter: "Planners & Journals",
  },
  {
    slug: "prompt_system",
    label: "Prompt System",
    blurb: "Structured AI prompt workflow or prompt operating system",
    filter: "Prompt Systems",
  },
  {
    slug: "educational_resource",
    label: "Educational Resource",
    blurb: "Workbook, lesson, learning resource or course material",
    filter: "Educational Resources",
  },
  {
    slug: "audio",
    label: "Audio",
    blurb: "MP3 or WAV",
    filter: "Audio",
  },
  {
    slug: "creator_production_system",
    label: "Creator Production System",
    blurb: "Multi-workflow production resource for film, TV, podcast or creator production",
    filter: "Creator Production Systems",
  },
];

/** Order used by the storefront Product Type filter (spec §6). */
export const PRODUCT_TYPE_FILTER_ORDER: ProductTypeSlug[] = [
  "interactive_decision_tool",
  "complete_digital_system",
  "live_dashboard_calculator",
  "interactive_pdf",
  "template_workbook",
  "prompt_system",
  "educational_resource",
  "audio",
];

export const PRODUCT_TYPE_BY_SLUG: Record<string, ProductTypeDef> = Object.fromEntries(
  PRODUCT_TYPE_DEFS.map((t) => [t.slug, t]),
);

/**
 * Legacy / free-text product-type labels mapped onto the official slugs.
 * "Business System" collided with the Business Systems *category*, so it maps
 * to Complete Digital System. Historical rows are never destroyed — this keeps
 * them resolvable at runtime.
 */
const PRODUCT_TYPE_ALIAS: Record<string, ProductTypeSlug> = {
  "business system": "complete_digital_system",
  "business operating system": "complete_digital_system",
  business_operating_system: "complete_digital_system",
  "complete business system": "complete_digital_system",
  "digital toolkit": "complete_digital_system",
  digital_toolkit: "complete_digital_system",
  "decision tool": "interactive_decision_tool",
  "decision system": "interactive_decision_tool",
  "decision engine": "interactive_decision_tool",
  "interactive tool": "interactive_decision_tool",
  "interactive system": "interactive_decision_tool",
  dashboard: "live_dashboard_calculator",
  calculator: "live_dashboard_calculator",
  "business template": "template_workbook",
  business_template: "template_workbook",
  template: "template_workbook",
  templates: "template_workbook",
  workbook: "template_workbook",
  "budget spreadsheet": "template_workbook",
  budget_spreadsheet: "template_workbook",
  "caption templates": "template_workbook",
  caption_template: "template_workbook",
  planner: "planner_journal",
  journal: "planner_journal",
  "digital journal": "planner_journal",
  printable_journal: "planner_journal",
  financial_planner: "planner_journal",
  wedding_planner: "planner_journal",
  wellness_planner: "planner_journal",
  life_planner: "planner_journal",
  "ai prompt pack": "prompt_system",
  ai_prompt_pack: "prompt_system",
  "prompt pack": "prompt_system",
  "bible study": "educational_resource",
  bible_study: "educational_resource",
  "children's educational": "educational_resource",
  childrens_educational: "educational_resource",
  course: "educational_resource",
  "creator business tool": "complete_digital_system",
  creator_business_tool: "complete_digital_system",
};

/** Category → Product Type fallback for rows with no stored product_type. */
const CATEGORY_PRODUCT_TYPE: Record<string, ProductTypeSlug> = {
  ebooks: "ebook",
  financial_planners: "planner_journal",
  printable_journals: "planner_journal",
  ai_prompt_packs: "prompt_system",
  prompt_packs: "prompt_system",
  business_templates: "template_workbook",
  budget_spreadsheets: "template_workbook",
  caption_templates: "template_workbook",
  digital_toolkits: "complete_digital_system",
  templates: "template_workbook",
  business_operating_systems: "complete_digital_system",
  creator_business_tools: "complete_digital_system",
  film_tv_creator_production: "creator_production_system",
  childrens_educational: "educational_resource",
  bible_studies: "educational_resource",
  courses: "educational_resource",
  audio: "audio",
};

/** Resolve any stored value (slug, legacy label, alias) to an official def. */
export function getProductTypeDef(value?: string | null): ProductTypeDef | undefined {
  if (!value) return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  const direct = PRODUCT_TYPE_BY_SLUG[raw];
  if (direct) return direct;
  const lower = raw.toLowerCase();
  if (PRODUCT_TYPE_BY_SLUG[lower]) return PRODUCT_TYPE_BY_SLUG[lower];
  const byLabel = PRODUCT_TYPE_DEFS.find((t) => t.label.toLowerCase() === lower);
  if (byLabel) return byLabel;
  const alias = PRODUCT_TYPE_ALIAS[lower];
  return alias ? PRODUCT_TYPE_BY_SLUG[alias] : undefined;
}

/**
 * The product type shown anywhere in the app. Falls back to the category map
 * so legacy rows without a stored product_type never disappear from filters.
 */
export function resolveProductType(input: {
  product_type?: string | null;
  category?: string | null;
  subcategory?: string | null;
}): ProductTypeDef | undefined {
  const stored = getProductTypeDef(input.product_type);
  if (stored) return stored;
  const sub = (input.subcategory ?? "").toLowerCase();
  if (sub === "interactive decision tools") {
    return PRODUCT_TYPE_BY_SLUG["interactive_decision_tool"];
  }
  if (sub === "live dashboards & calculators") {
    return PRODUCT_TYPE_BY_SLUG["live_dashboard_calculator"];
  }
  const def = getCategoryDef(input.category);
  const slug = def?.slug ?? (input.category ?? "").toLowerCase();
  const mapped = CATEGORY_PRODUCT_TYPE[slug];
  return mapped ? PRODUCT_TYPE_BY_SLUG[mapped] : undefined;
}

export function productTypeLabel(input: {
  product_type?: string | null;
  category?: string | null;
  subcategory?: string | null;
}): string | undefined {
  return resolveProductType(input)?.label;
}

/** True when the "Get the Complete System" CTA is the right language. */
export function isCompleteSystemType(value?: string | null): boolean {
  const slug = getProductTypeDef(value)?.slug;
  return (
    slug === "complete_digital_system" ||
    slug === "interactive_decision_tool" ||
    slug === "creator_production_system"
  );
}

/* ------------------------------------------------------------------ *
 * LEVEL 2 — Subcategory / System Type
 * ------------------------------------------------------------------ */

/** The field label changes per category so no term appears at two levels. */
export function subcategoryFieldLabel(categorySlugOrLabel?: string | null): string {
  const def = getCategoryDef(categorySlugOrLabel);
  return def?.slug === BUSINESS_SYSTEMS_SLUG ? "System Type" : "Subcategory";
}

export const SUBCATEGORY_FIELD_HELPER =
  "What specific business function does this product serve?";
export const CATEGORY_FIELD_HELPER = "Where should shoppers find this product?";
export const PRODUCT_TYPE_FIELD_HELPER =
  "How does the customer use or experience this product?";

/** Static fallback options for a category (managed rows win at runtime). */
export function staticSubcategoryOptions(categorySlugOrLabel?: string | null): string[] {
  const def = getCategoryDef(categorySlugOrLabel);
  if (!def) return [];
  return SUBCATEGORIES[def.slug] ?? def.subs ?? [];
}

/* ------------------------------------------------------------------ *
 * LEVEL 1 — Category (filter order per spec §6)
 * ------------------------------------------------------------------ */

export const CATEGORY_FILTER_ORDER = [
  "Business Systems",
  "Creator Business Tools",
  "Film, TV & Creator Production",
  "eBooks",
  "Planners",
  "Journals",
  "AI Prompt Packs",
  "Caption Templates",
] as const;

/** Category labels in filter order, restricted to categories that exist. */
export function orderedFilterCategories(available: string[]): string[] {
  const set = new Set(available);
  const ordered = CATEGORY_FILTER_ORDER.filter((c) => set.has(c));
  const rest = available.filter((c) => !ordered.includes(c as never));
  return [...ordered, ...rest];
}

export const ALL_CATEGORY_LABELS = CATEGORIES.map((c) => c.label);

/* ------------------------------------------------------------------ *
 * Delivery Contents (not taxonomy — what the buyer receives)
 * ------------------------------------------------------------------ */

export const DELIVERY_CONTENT_OPTIONS = [
  "PDF",
  "XLSX",
  "ZIP",
  "DOCX",
  "CSV",
  "Templates",
  "Sample Data",
  "Live Tool Included",
  "Interactive PDF",
  "Decision Engine",
  "Quick Start Guide",
  "Reference Guide",
  "Other",
] as const;

export type DeliveryContent = (typeof DELIVERY_CONTENT_OPTIONS)[number];

export function isDeliveryContent(v: string): v is DeliveryContent {
  return (DELIVERY_CONTENT_OPTIONS as readonly string[]).includes(v);
}

/** "PDF + XLSX + Templates" — the single metadata line on product pages. */
export function deliverySummary(contents?: string[] | null, max = 3): string {
  const list = (contents ?? []).filter((c) => c && c !== "Other");
  if (!list.length) return "";
  return list.slice(0, max).join(" + ");
}

/** At most two premium badges, never a pile-up (spec §13/§21). */
export function productBadges(input: {
  product_type?: string | null;
  category?: string | null;
  subcategory?: string | null;
  delivery_contents?: string[] | null;
}): string[] {
  const badges: string[] = [];
  const type = resolveProductType(input);
  if (type) badges.push(type.label);
  const sub = (input.subcategory ?? "").trim();
  if (sub && sub === "Interactive Decision Tools" && type?.slug !== "interactive_decision_tool") {
    badges.push("Interactive Decision Tool");
  } else if ((input.delivery_contents ?? []).includes("Live Tool Included")) {
    badges.push("Live Tools Included");
  }
  return badges.slice(0, 2);
}
