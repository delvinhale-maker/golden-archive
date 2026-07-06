// Central config for all digital product types supported in the publish flow.
// The FAB routes to /dashboard/new?type=<key> and the publish flow reads this
// map to auto-select the category, restrict accepted file uploads, seed a
// suggested price, and label the review-step badge.

export type ProductTypeKey =
  | "ebook"
  | "financial_planner"
  | "ai_prompt_pack"
  | "budget_spreadsheet"
  | "printable_journal"
  | "childrens_educational"
  | "bible_study"
  | "course"
  | "digital_toolkit"
  | "business_operating_system"
  | "business_template"
  | "audio"
  | "other";

export type ProductCategoryEnum =
  | "ebooks"
  | "courses"
  | "templates"
  | "audio"
  | "leadership"
  | "finance"
  | "purpose"
  | "business"
  | "financial_planners"
  | "ai_prompt_packs"
  | "business_templates"
  | "budget_spreadsheets"
  | "printable_journals"
  | "childrens_educational"
  | "bible_studies"
  | "digital_toolkits"
  | "business_operating_systems";

export interface ProductTypeConfig {
  key: ProductTypeKey;
  label: string;
  emoji: string;
  tagline: string;
  category: ProductCategoryEnum;
  categoryLabel: string;
  fileExts: string[]; // lowercase, no dot
  fileMimes: string[];
  acceptString: string; // for <input accept="...">
  acceptedHint: string; // shown under upload zone
  suggestedPriceCents: number;
  accent: string; // hex color for badges
  isEbook: boolean;
}

const OFFICE_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const OFFICE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const PRODUCT_TYPES: Record<ProductTypeKey, ProductTypeConfig> = {
  ebook: {
    key: "ebook",
    label: "eBook",
    emoji: "📚",
    tagline: "KDP-style publish flow (PDF, EPUB, DOCX)",
    category: "ebooks",
    categoryLabel: "eBook",
    fileExts: ["pdf", "epub", "docx"],
    fileMimes: ["application/pdf", "application/epub+zip", OFFICE_DOCX],
    acceptString: ".pdf,.epub,.docx,application/pdf,application/epub+zip," + OFFICE_DOCX,
    acceptedHint: ".PDF, .EPUB, .DOCX",
    suggestedPriceCents: 999,
    accent: "#B8860B",
    isEbook: true,
  },
  financial_planner: {
    key: "financial_planner",
    label: "Financial Planner",
    emoji: "📋",
    tagline: "PDF planner, tracker, or workbook",
    category: "financial_planners",
    categoryLabel: "Financial Planner",
    fileExts: ["pdf", "xlsx"],
    fileMimes: ["application/pdf", OFFICE_XLSX],
    acceptString: ".pdf,.xlsx,application/pdf," + OFFICE_XLSX,
    acceptedHint: ".PDF, .XLSX",
    suggestedPriceCents: 1999,
    accent: "#1A6B3A",
    isEbook: false,
  },
  ai_prompt_pack: {
    key: "ai_prompt_pack",
    label: "AI Prompt Pack",
    emoji: "🤖",
    tagline: "PDF, TXT, or JSON prompt collection",
    category: "ai_prompt_packs",
    categoryLabel: "AI Prompt Pack",
    fileExts: ["pdf", "txt", "json"],
    fileMimes: ["application/pdf", "text/plain", "application/json"],
    acceptString: ".pdf,.txt,.json,application/pdf,text/plain,application/json",
    acceptedHint: ".PDF, .TXT, .JSON",
    suggestedPriceCents: 999,
    accent: "#1A3A8F",
    isEbook: false,
  },
  budget_spreadsheet: {
    key: "budget_spreadsheet",
    label: "Budget Spreadsheet",
    emoji: "📊",
    tagline: "XLSX or Google Sheets template",
    category: "budget_spreadsheets",
    categoryLabel: "Budget Spreadsheet",
    fileExts: ["xlsx", "csv", "pdf"],
    fileMimes: [OFFICE_XLSX, "text/csv", "application/pdf"],
    acceptString: ".xlsx,.csv,.pdf," + OFFICE_XLSX + ",text/csv,application/pdf",
    acceptedHint: ".XLSX, .CSV, .PDF",
    suggestedPriceCents: 1499,
    accent: "#166534",
    isEbook: false,
  },
  printable_journal: {
    key: "printable_journal",
    label: "Printable Journal",
    emoji: "📓",
    tagline: "PDF journal or printable pages",
    category: "printable_journals",
    categoryLabel: "Printable Journal",
    fileExts: ["pdf"],
    fileMimes: ["application/pdf"],
    acceptString: ".pdf,application/pdf",
    acceptedHint: ".PDF",
    suggestedPriceCents: 999,
    accent: "#BE185D",
    isEbook: false,
  },
  childrens_educational: {
    key: "childrens_educational",
    label: "Children's Educational",
    emoji: "🎓",
    tagline: "PDF activity, lesson, or workbook",
    category: "childrens_educational",
    categoryLabel: "Children's Educational",
    fileExts: ["pdf"],
    fileMimes: ["application/pdf"],
    acceptString: ".pdf,application/pdf",
    acceptedHint: ".PDF",
    suggestedPriceCents: 1299,
    accent: "#D97706",
    isEbook: false,
  },
  bible_study: {
    key: "bible_study",
    label: "Bible Study",
    emoji: "✝️",
    tagline: "PDF study guide or devotional",
    category: "bible_studies",
    categoryLabel: "Bible Study",
    fileExts: ["pdf", "docx"],
    fileMimes: ["application/pdf", OFFICE_DOCX],
    acceptString: ".pdf,.docx,application/pdf," + OFFICE_DOCX,
    acceptedHint: ".PDF, .DOCX",
    suggestedPriceCents: 1499,
    accent: "#4B2D8F",
    isEbook: false,
  },
  course: {
    key: "course",
    label: "Course",
    emoji: "🎯",
    tagline: "PDF, video, or multi-file course bundle",
    category: "courses",
    categoryLabel: "Course",
    fileExts: ["pdf", "mp4", "zip"],
    fileMimes: ["application/pdf", "video/mp4", "application/zip"],
    acceptString: ".pdf,.mp4,.zip,application/pdf,video/mp4,application/zip",
    acceptedHint: ".PDF, .MP4, .ZIP",
    suggestedPriceCents: 4999,
    accent: "#C47B00",
    isEbook: false,
  },
  digital_toolkit: {
    key: "digital_toolkit",
    label: "Digital Toolkit",
    emoji: "🛠️",
    tagline: "ZIP bundle of multiple files",
    category: "digital_toolkits",
    categoryLabel: "Digital Toolkit",
    fileExts: ["zip", "pdf"],
    fileMimes: ["application/zip", "application/pdf"],
    acceptString: ".zip,.pdf,application/zip,application/pdf",
    acceptedHint: ".ZIP, .PDF",
    suggestedPriceCents: 2999,
    accent: "#475569",
    isEbook: false,
  },
  business_operating_system: {
    key: "business_operating_system",
    label: "Business Operating System",
    emoji: "⚙️",
    tagline: "PDF or DOCX system",
    category: "business_operating_systems",
    categoryLabel: "Business Operating System",
    fileExts: ["pdf", "docx", "zip"],
    fileMimes: ["application/pdf", OFFICE_DOCX, "application/zip"],
    acceptString: ".pdf,.docx,.zip,application/pdf," + OFFICE_DOCX + ",application/zip",
    acceptedHint: ".PDF, .DOCX, .ZIP",
    suggestedPriceCents: 2999,
    accent: "#0F766E",
    isEbook: false,
  },
  business_template: {
    key: "business_template",
    label: "Business Template",
    emoji: "📋",
    tagline: "DOCX, XLSX, or PDF template",
    category: "business_templates",
    categoryLabel: "Business Template",
    fileExts: ["docx", "xlsx", "pdf"],
    fileMimes: [OFFICE_DOCX, OFFICE_XLSX, "application/pdf"],
    acceptString: ".docx,.xlsx,.pdf," + OFFICE_DOCX + "," + OFFICE_XLSX + ",application/pdf",
    acceptedHint: ".DOCX, .XLSX, .PDF",
    suggestedPriceCents: 1999,
    accent: "#1E40AF",
    isEbook: false,
  },
  audio: {
    key: "audio",
    label: "Audio",
    emoji: "🎵",
    tagline: "MP3 or WAV file",
    category: "audio",
    categoryLabel: "Audio",
    fileExts: ["mp3", "wav", "m4a"],
    fileMimes: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"],
    acceptString: ".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4",
    acceptedHint: ".MP3, .WAV, .M4A",
    suggestedPriceCents: 999,
    accent: "#0D9488",
    isEbook: false,
  },
  other: {
    key: "other",
    label: "Other Digital Product",
    emoji: "🗂️",
    tagline: "Any supported file type",
    category: "templates",
    categoryLabel: "Digital Product",
    fileExts: ["pdf", "zip", "docx", "xlsx", "mp3", "mp4"],
    fileMimes: [
      "application/pdf", "application/zip", OFFICE_DOCX, OFFICE_XLSX,
      "audio/mpeg", "video/mp4",
    ],
    acceptString: ".pdf,.zip,.docx,.xlsx,.mp3,.mp4,application/pdf,application/zip," +
      OFFICE_DOCX + "," + OFFICE_XLSX + ",audio/mpeg,video/mp4",
    acceptedHint: ".PDF, .ZIP, .DOCX, .XLSX, .MP3, .MP4",
    suggestedPriceCents: 1499,
    accent: "#6B7280",
    isEbook: false,
  },
};

export const PRODUCT_TYPE_ORDER: ProductTypeKey[] = [
  "financial_planner",
  "ai_prompt_pack",
  "budget_spreadsheet",
  "printable_journal",
  "childrens_educational",
  "bible_study",
  "course",
  "digital_toolkit",
  "business_operating_system",
  "business_template",
  "audio",
  "other",
];

export function getProductType(key: string | undefined | null): ProductTypeConfig {
  if (!key) return PRODUCT_TYPES.ebook;
  return (PRODUCT_TYPES as Record<string, ProductTypeConfig>)[key] ?? PRODUCT_TYPES.ebook;
}

// Map a stored category (from a saved product) back to a display config, used
// for bookshelf and storefront badges. Falls back to a generic "Digital"
// styling when the category isn't in our type map.
export function categoryDisplay(category: string | null | undefined): { label: string; accent: string } {
  const c = (category ?? "").toLowerCase();
  const match = Object.values(PRODUCT_TYPES).find((t) => t.category === c);
  if (match) return { label: match.categoryLabel, accent: match.accent };
  // Legacy top-level categories
  const legacy: Record<string, { label: string; accent: string }> = {
    finance: { label: "Finance", accent: "#1A6B3A" },
    leadership: { label: "Leadership", accent: "#4B2D8F" },
    purpose: { label: "Purpose", accent: "#BE185D" },
    business: { label: "Business", accent: "#1E40AF" },
    templates: { label: "Template", accent: "#475569" },
  };
  return legacy[c] ?? { label: category || "Digital", accent: "#6B7280" };
}
