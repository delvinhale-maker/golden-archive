// Merchandising layer for the "Creator Business Tools" department.
// A distinct top-level store category (`creator_business_tools`) — it is NOT a
// child of Planners or Content/Caption Templates. Subcategory names mirror the
// admin-managed `product_subcategories` rows, so no parallel taxonomy exists.

export const CREATOR_TOOLS_SLUG = "creator_business_tools";
export const CREATOR_TOOLS_LABEL = "Creator Business Tools";
export const CREATOR_TOOLS_TAGLINE =
  "Professional systems for creators, influencers, UGC professionals & personal brands.";
export const CREATOR_TOOLS_DESCRIPTION =
  "Build your creator business with professional tools designed for brand partnerships, monetization, outreach, campaign management, pricing, analytics, and growth.";

export type CreatorToolSub = {
  /** Filter chip label (short). */
  filter: string;
  /** Subcategory name stored on products (product_subcategories.name). */
  name: string;
  blurb: string;
};

export const CREATOR_TOOL_SUBS: CreatorToolSub[] = [
  {
    filter: "Media Kits",
    name: "Media Kits & Rate Cards",
    blurb:
      "Interactive media kits, audience metrics, service menus, and rate cards that present your work professionally.",
  },
  {
    filter: "Partnerships",
    name: "Brand Partnerships & Outreach",
    blurb:
      "Pitch builders, outreach frameworks, and partnership pipelines for landing and keeping brand deals.",
  },
  {
    filter: "Campaigns",
    name: "Campaign Management",
    blurb:
      "Deliverable trackers, content approval logs, and usage-rights records to run campaigns cleanly.",
  },
  {
    filter: "Analytics",
    name: "Creator Analytics & Reporting",
    blurb:
      "Performance dashboards and brand-ready reporting that prove the value of your audience.",
  },
  {
    filter: "Payments",
    name: "Invoicing & Payments",
    blurb:
      "Invoice logs, payment tracking, and revenue dashboards built for partnership income.",
  },
  {
    filter: "UGC & Clients",
    name: "UGC & Client Systems",
    blurb:
      "Client-facing systems for UGC creators, retainers, collaborations, and repeat work.",
  },
];

export const CREATOR_TOOL_SUB_NAMES = CREATOR_TOOL_SUBS.map((s) => s.name);

export const CREATOR_TOOLS_FLAGSHIP = {
  title: "The Interactive Influencer Media Kit Builder™",
  subtitle:
    "Build your media kit. Price your work. Pitch brands. Manage partnerships. Prove your value.",
  description:
    "A complete interactive creator-partnership system designed to help influencers, UGC creators, podcasters, YouTubers, social creators, and personal brands professionally present their audience, establish rates, pitch brands, manage campaigns, track payments, document usage rights, measure results, and grow their partnership business.",
  productType: "Interactive PDF",
  subcategory: "Media Kits & Rate Cards",
  badges: ["Interactive", "Creator Business", "Brand Partnerships"] as const,
  regularPrice: 24.99,
  launchPrice: 19.99,
  /** Short summary used on cards — never the full highlight list. */
  cardSummary:
    "Media kit, rate card, brand pitches, campaign tracking, and partnership revenue — in one interactive system.",
  /** Full highlight list — product detail / category feature area only. */
  highlights: [
    "Creator Profile & Brand Foundation",
    "Audience & Platform Metrics",
    "Interactive Media Kit Builder",
    "Services & Rate Card",
    "Brand Deal Pricing System",
    "Brand Outreach & Pitch Builder",
    "Partnership Pipeline",
    "Campaign Management",
    "Content Approval Tracking",
    "Campaign Analytics",
    "Brand Reporting",
    "Usage Rights Tracking",
    "Contract Organization",
    "Invoice & Payment Tracking",
    "Partnership Revenue Dashboard",
    "90-Day Creator Growth Plan",
  ],
  /** Matched case-insensitively against live listing titles. */
  titleMatch: "influencer media kit builder",
} as const;

export function isCreatorBusinessTool(
  categorySlugOrLabel?: string | null,
): boolean {
  const v = (categorySlugOrLabel ?? "").toLowerCase();
  return v === CREATOR_TOOLS_SLUG || v === CREATOR_TOOLS_LABEL.toLowerCase();
}
