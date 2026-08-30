/**
 * Single source of truth for Academy category slugs/labels used by the admin
 * editor, uploader and the public ingest endpoint. Keep in sync with the
 * `academy_categories` table (slugs must match exactly).
 */

export const ACADEMY_CATEGORIES = [
  { value: "financial-freedom", label: "Financial Freedom" },
  { value: "ai-productivity", label: "AI & Productivity" },
  { value: "digital-publishing", label: "Digital Publishing" },
  { value: "kingdom-living", label: "Kingdom Living" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
  { value: "creator-economy", label: "Creator Economy" },
  { value: "ai-governance-digital-rights", label: "AI Governance & Digital Rights" },
  { value: "business-systems", label: "Business Systems" },
  { value: "film-tv-media", label: "Film, TV & Media" },
  { value: "personal-finance", label: "Personal Finance" },
  { value: "life-planning", label: "Life Planning" },
] as const;

export const ACADEMY_CATEGORY_VALUES = ACADEMY_CATEGORIES.map((c) => c.value);

/** Loose matching so real-world files (e.g. "AI & Productivity") import cleanly. */
export const ACADEMY_CATEGORY_ALIASES: Record<string, string> = {
  ai: "ai-productivity",
  aiproductivity: "ai-productivity",
  productivity: "ai-productivity",
  automation: "ai-productivity",
  financial: "financial-freedom",
  financialfreedom: "financial-freedom",
  money: "financial-freedom",
  credit: "financial-freedom",
  publishing: "digital-publishing",
  digitalpublishing: "digital-publishing",
  selfpublishing: "digital-publishing",
  writing: "digital-publishing",
  kingdom: "kingdom-living",
  kingdomliving: "kingdom-living",
  faith: "kingdom-living",
  business: "entrepreneurship",
  entrepreneur: "entrepreneurship",
  entrepreneurship: "entrepreneurship",
  startup: "entrepreneurship",
  creator: "creator-economy",
  creatoreconomy: "creator-economy",
  creators: "creator-economy",
  aigovernance: "ai-governance-digital-rights",
  aigovernancedigitalrights: "ai-governance-digital-rights",
  digitalrights: "ai-governance-digital-rights",
  aiethics: "ai-governance-digital-rights",
  licensing: "ai-governance-digital-rights",
  businesssystems: "business-systems",
  systems: "business-systems",
  operatingsystems: "business-systems",
  film: "film-tv-media",
  filmtv: "film-tv-media",
  filmtvmedia: "film-tv-media",
  media: "film-tv-media",
  tv: "film-tv-media",
  personalfinance: "personal-finance",
  budgeting: "personal-finance",
  taxes: "personal-finance",
  lifeplanning: "life-planning",
  planning: "life-planning",
  planners: "life-planning",
  goals: "life-planning",
  habits: "life-planning",
};
