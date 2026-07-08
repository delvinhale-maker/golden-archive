// Single source of truth for the 13 marketplace categories.
// Each entry ships a DB slug, display label, accent color, icon, blurb,
// gradient hero background, and curated sub-category pills.

export type CategoryDef = {
  slug: string; // DB enum value
  label: string; // Display label
  accent: string; // Accent hex (buttons, pills, icons)
  ink: string; // Hero text color
  icon: string; // Emoji glyph
  blurb: string; // AI-style description shown on the category hero
  gradient: string; // Full CSS gradient for the hero
  subs: string[]; // Sub-category filter pills (client-side keyword filter)
};

// Helper — build a rich, layered gradient from a single accent hex.
const grad = (a: string, b: string, c: string) =>
  `linear-gradient(135deg, ${a} 0%, ${b} 55%, ${c} 100%)`;

export const CATEGORIES: CategoryDef[] = [
  {
    slug: "ebooks",
    label: "eBooks",
    accent: "#B8860B",
    ink: "#FFFFFF",
    icon: "📖",
    blurb:
      "Long-form reads on wealth, wisdom, and stewardship — curated from operators, theologians, and builders.",
    gradient: grad("#1A1408", "#3A2A0F", "#B8860B"),
    subs: ["Finance", "Leadership", "Faith", "Wealth", "Biographies", "Startup"],
  },
  {
    slug: "financial_planners",
    label: "Financial Planners",
    accent: "#1A6B3A",
    ink: "#FFFFFF",
    icon: "💰",
    blurb:
      "Printable and digital planners for cash flow, tithe, debt payoff, and long-horizon wealth building.",
    gradient: grad("#0A1F13", "#123D25", "#1A6B3A"),
    subs: ["Monthly", "Weekly", "Debt Payoff", "Tithe", "Investments", "Retirement"],
  },
  {
    slug: "ai_prompt_packs",
    label: "AI Prompt Packs",
    accent: "#1A3A8F",
    ink: "#FFFFFF",
    icon: "🤖",
    blurb:
      "Battle-tested prompt libraries for ChatGPT, Claude, and Gemini — organized by outcome, not by hype.",
    gradient: grad("#08132E", "#0F2359", "#1A3A8F"),
    subs: ["Marketing", "Sales", "Coding", "Sermons", "Design", "Research"],
  },
  {
    slug: "business_templates",
    label: "Business Templates",
    accent: "#2E5B8A",
    ink: "#FFFFFF",
    icon: "📋",
    blurb:
      "Contracts, proposals, SOPs, and pitch decks — copy-ready templates for founders shipping this week.",
    gradient: grad("#0E1D2E", "#1B3958", "#2E5B8A"),
    subs: ["Contracts", "Proposals", "SOPs", "Decks", "Invoices", "HR"],
  },
  {
    slug: "budget_spreadsheets",
    label: "Budget Spreadsheets",
    accent: "#2D6A4F",
    ink: "#FFFFFF",
    icon: "📊",
    blurb:
      "Google Sheets and Excel workbooks with real formulas — budget, forecast, and steward every dollar.",
    gradient: grad("#0B1F17", "#164033", "#2D6A4F"),
    subs: ["Personal", "Household", "Small Business", "Church", "Ministry", "Freelance"],
  },
  {
    slug: "printable_journals",
    label: "Journals",
    accent: "#8F3A5B",
    ink: "#FFFFFF",
    icon: "📓",
    blurb:
      "Beautiful PDF journals for reflection, gratitude, prayer, and creative practice — print at home or bind.",
    gradient: grad("#2A0F1B", "#5A2237", "#8F3A5B"),
    subs: ["Gratitude", "Prayer", "Devotional", "Habit", "Bullet", "Kids"],
  },
  {
    slug: "childrens_educational",
    label: "Children's Educational",
    accent: "#0D7A8A",
    ink: "#FFFFFF",
    icon: "🎓",
    blurb:
      "Faith-forward worksheets, activity packs, and unit studies for parents raising sharp, kind kids.",
    gradient: grad("#062A31", "#0A4E58", "#0D7A8A"),
    subs: ["Preschool", "Elementary", "Middle", "Bible", "Math", "Reading"],
  },
  {
    slug: "bible_studies",
    label: "Bible Studies",
    accent: "#4B2D8F",
    ink: "#FFFFFF",
    icon: "✝️",
    blurb:
      "Verse-by-verse guides, small-group curricula, and personal studies rooted in the whole counsel of Scripture.",
    gradient: grad("#160A31", "#2E1B58", "#4B2D8F"),
    subs: ["Old Testament", "New Testament", "Topical", "Women", "Men", "Youth"],
  },
  {
    slug: "digital_toolkits",
    label: "Digital Toolkits",
    accent: "#3A4A5C",
    ink: "#FFFFFF",
    icon: "🛠️",
    blurb:
      "All-in-one bundles: templates, checklists, prompts, and worksheets grouped by role and outcome.",
    gradient: grad("#0E141B", "#1E2938", "#3A4A5C"),
    subs: ["Creator", "Consultant", "Coach", "Founder", "Pastor", "Freelancer"],
  },
  {
    slug: "business_operating_systems",
    label: "Business Operating Systems",
    accent: "#1A2E4A",
    ink: "#FFFFFF",
    icon: "⚙️",
    blurb:
      "Notion, ClickUp, and Airtable systems that run the whole business — hiring, ops, delivery, and finance.",
    gradient: grad("#060B14", "#0F1D2F", "#1A2E4A"),
    subs: ["Notion", "ClickUp", "Airtable", "EOS", "Agency", "Studio"],
  },
  {
    slug: "prompt_packs",
    label: "Prompt Packs",
    accent: "#6C3AD1",
    ink: "#FFFFFF",
    icon: "✨",
    blurb:
      "Battle-tested prompt libraries for ChatGPT, Claude, and Gemini — for marketing, ops, writing, and research.",
    gradient: grad("#150A2E", "#2A1657", "#6C3AD1"),
    subs: ["ChatGPT", "Claude", "Gemini", "Marketing", "Writing", "Research"],
  },
  {
    slug: "templates",
    label: "Templates",
    accent: "#3A4A5C",
    ink: "#FFFFFF",
    icon: "🗂️",
    blurb:
      "Ready-to-ship templates for Figma, Notion, Docs, and Slides — designed by working operators.",
    gradient: grad("#0E141B", "#1E2938", "#3A4A5C"),
    subs: ["Notion", "Figma", "Docs", "Slides", "Canva", "Email"],
  },
];

// Fast lookups (built once at module load).
export const CATEGORY_BY_SLUG: Record<string, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
);
export const CATEGORY_BY_LABEL: Record<string, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.label, c]),
);

// Legacy DB slugs that may still exist on old rows — map to the closest new category.
const LEGACY_ALIAS: Record<string, string> = {
  leadership: "business_templates",
  finance: "budget_spreadsheets",
  purpose: "printable_journals",
  business: "business_operating_systems",
};

export function slugToLabel(slug?: string | null): string {
  if (!slug) return "eBooks";
  const key = slug.toLowerCase();
  const direct = CATEGORY_BY_SLUG[key];
  if (direct) return direct.label;
  const aliased = LEGACY_ALIAS[key];
  if (aliased && CATEGORY_BY_SLUG[aliased]) return CATEGORY_BY_SLUG[aliased].label;
  // Fallback — capitalize
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// Aliases for short tab labels used in the header nav.
const LABEL_ALIAS: Record<string, string> = {
  "Digital Journals": "printable_journals",
  Finance: "financial_planners",
  Leadership: "business_templates",
  Purpose: "printable_journals",
  Business: "business_operating_systems",
};

export function labelToSlug(label?: string | null): string | undefined {
  if (!label) return undefined;
  const direct = CATEGORY_BY_LABEL[label];
  if (direct) return direct.slug;
  const alias = LABEL_ALIAS[label];
  if (alias) return alias;
  const lower = label.toLowerCase();
  if (CATEGORY_BY_SLUG[lower]) return lower;
  // Case-insensitive label match (e.g. "journals" -> "Journals").
  const caseInsensitive = CATEGORIES.find((c) => c.label.toLowerCase() === lower);
  if (caseInsensitive) return caseInsensitive.slug;
  return undefined;
}

export function getCategoryDef(labelOrSlug?: string | null): CategoryDef | undefined {
  if (!labelOrSlug) return undefined;
  const lower = labelOrSlug.toLowerCase();
  return (
    CATEGORY_BY_LABEL[labelOrSlug] ??
    CATEGORY_BY_SLUG[lower] ??
    // Case-insensitive label match (e.g. "journals" -> printable_journals).
    CATEGORIES.find((c) => c.label.toLowerCase() === lower) ??
    (LEGACY_ALIAS[lower]
      ? CATEGORY_BY_SLUG[LEGACY_ALIAS[lower]]
      : undefined)
  );
}
