// Merchandising layer for the "Business Systems" department.
// Reuses the existing `business_operating_systems` product category slug and
// the admin-managed `product_subcategories` rows — no parallel taxonomy.

export const BUSINESS_SYSTEMS_SLUG = "business_operating_systems";
export const BUSINESS_SYSTEMS_LABEL = "Business Systems";
export const BUSINESS_SYSTEMS_TAGLINE =
  "Ready-to-Use Digital Systems for Modern Business";
export const BUSINESS_SYSTEMS_POSITIONING =
  "Not just information. Not just prompts. Systems you can actually put to work.";

export type BusinessSystemType =
  | "ai-business"
  | "creator-business"
  | "marketing"
  | "sales-client"
  | "operations"
  | "decision-tools";

export type BusinessSystemSub = {
  /** Optional taxonomy key for product classification. */
  type: BusinessSystemType;
  /** Filter chip label. */
  filter: string;
  /** Subcategory name stored on products (product_subcategories.name). */
  name: string;
  blurb: string;
};

export const BUSINESS_SYSTEM_SUBS: BusinessSystemSub[] = [
  {
    type: "ai-business",
    filter: "AI Business",
    name: "AI Business Systems",
    blurb:
      "Structured AI systems combining business context, prompts, workflows, dashboards, quality controls, and human approval.",
  },
  {
    type: "creator-business",
    filter: "Creator Business",
    name: "Creator Business Systems",
    blurb:
      "Complete systems for creators managing content, products, brand partnerships, launches, and revenue workflows.",
  },
  {
    type: "marketing",
    filter: "Marketing",
    name: "Marketing Systems",
    blurb:
      "Ready-to-use systems for planning, creating, organizing, and reviewing marketing activity.",
  },
  {
    type: "sales-client",
    filter: "Sales & Client",
    name: "Sales & Client Systems",
    blurb:
      "Structured tools for managing leads, clients, follow-ups, proposals, and customer relationships.",
  },
  {
    type: "operations",
    filter: "Operations",
    name: "Operations & Productivity Systems",
    blurb:
      "Practical systems for documenting work, organizing projects, improving handoffs, and running day-to-day operations.",
  },
  {
    type: "decision-tools",
    filter: "Decision Tools",
    name: "Interactive Decision Tools",
    blurb:
      "Interactive tools designed to help users compare options, evaluate decisions, and organize important information.",
  },
];

export const BUSINESS_SYSTEM_SUB_NAMES = BUSINESS_SYSTEM_SUBS.map((s) => s.name);

export const BUSINESS_SYSTEMS_FLAGSHIP = {
  title: "The AI Small Business Operating System",
  subtitle:
    "A Ready-to-Use System for Marketing, Sales, Customer Service, Operations & Executive Planning",
  subcategory: "AI Business Systems",
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
