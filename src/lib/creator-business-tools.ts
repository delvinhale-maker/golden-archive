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
  /** URL slug for the dedicated subcategory landing page. */
  slug: string;
  /** Filter chip label (short). */
  filter: string;
  /** Subcategory name stored on products (product_subcategories.name). */
  name: string;
  blurb: string;
  /** Longer intro copy for the dedicated landing page. */
  intro: string;
  /** Bullets describing what buyers get in this group. */
  points: string[];
};

export const CREATOR_TOOL_SUBS: CreatorToolSub[] = [
  {
    slug: "media-kits-rate-cards",
    filter: "Media Kits",
    name: "Media Kits & Rate Cards",
    blurb:
      "Interactive media kits, audience metrics, service menus, and rate cards that present your work professionally.",
    intro:
      "Present your audience, your work, and your pricing like a professional media company. These tools turn scattered screenshots and DMs into a polished media kit and a rate card brands can say yes to.",
    points: [
      "Interactive media kit layouts you can update in minutes",
      "Audience and platform metric sections brands actually ask for",
      "Service menus and deliverable descriptions",
      "Rate cards with tiered and bundled pricing",
    ],
  },
  {
    slug: "brand-partnerships-outreach",
    filter: "Partnerships",
    name: "Brand Partnerships & Outreach",
    blurb:
      "Pitch builders, outreach frameworks, and partnership pipelines for landing and keeping brand deals.",
    intro:
      "Stop waiting to be discovered. These systems give you a repeatable outreach motion — who to contact, what to send, and how to follow up until the deal closes.",
    points: [
      "Cold and warm pitch frameworks",
      "Outreach trackers with follow-up cadences",
      "Partnership pipeline stages from lead to signed",
      "Renewal and long-term retainer prompts",
    ],
  },
  {
    slug: "campaign-management",
    filter: "Campaigns",
    name: "Campaign Management",
    blurb:
      "Deliverable trackers, content approval logs, and usage-rights records to run campaigns cleanly.",
    intro:
      "Run brand campaigns without dropped deliverables or missed revisions. Track every asset, approval, and usage window in one place.",
    points: [
      "Deliverable and due-date trackers",
      "Content approval and revision logs",
      "Usage-rights and exclusivity records",
      "Contract and asset organization",
    ],
  },
  {
    slug: "creator-analytics-reporting",
    filter: "Analytics",
    name: "Creator Analytics & Reporting",
    blurb:
      "Performance dashboards and brand-ready reporting that prove the value of your audience.",
    intro:
      "Prove results, then charge for them. These tools translate raw platform numbers into brand-ready reporting that justifies your rates.",
    points: [
      "Campaign performance dashboards",
      "Brand recap report layouts",
      "Engagement and conversion tracking",
      "Before/after benchmarking for renewals",
    ],
  },
  {
    slug: "invoicing-payments",
    filter: "Payments",
    name: "Invoicing & Payments",
    blurb:
      "Invoice logs, payment tracking, and revenue dashboards built for partnership income.",
    intro:
      "Get paid on time and know exactly what you earned. Built for creator income — partnerships, retainers, affiliate, and product revenue.",
    points: [
      "Invoice logs with payment status",
      "Net terms and follow-up reminders",
      "Partnership revenue dashboards",
      "Income breakdowns by client and platform",
    ],
  },
  {
    slug: "ugc-client-systems",
    filter: "UGC & Clients",
    name: "UGC & Client Systems",
    blurb:
      "Client-facing systems for UGC creators, retainers, collaborations, and repeat work.",
    intro:
      "Deliver like an agency of one. Onboarding, briefs, and hand-off systems that make UGC clients want to keep working with you.",
    points: [
      "Client onboarding and intake flows",
      "Creative brief and concept templates",
      "Revision and delivery hand-off checklists",
      "Retainer and repeat-work structures",
    ],
  },
];

export function getCreatorToolSubBySlug(
  slug?: string | null,
): CreatorToolSub | undefined {
  const v = (slug ?? "").toLowerCase();
  return CREATOR_TOOL_SUBS.find((s) => s.slug === v);
}


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
