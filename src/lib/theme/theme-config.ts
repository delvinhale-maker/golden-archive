export type ThemeTokens = {
  tabName: string;
  accentColor: string;
  gradientStart: string;
  gradientEnd: string; // always near black
};

// White page background across the app. The top hero uses `av-hero-bg`
// (defined in styles.css) and is unaffected by this token.
const PAGE_BG = "#FFFFFF";
// Darker gold reads accessibly on white surfaces.
const GOLD_ON_WHITE = "#9A6C08";

const mk = (tabName: string, accentColor: string, _gradientStart?: string): ThemeTokens => ({
  tabName,
  accentColor,
  gradientStart: PAGE_BG,
  gradientEnd: PAGE_BG,
});

// Category (?category=...) → theme, matched on /products
export const CATEGORY_THEMES: Record<string, ThemeTokens> = {
  ebooks:              mk("eBooks",             GOLD_ON_WHITE),
  journals:            mk("Journals",           "#8F3A5B"),
  templates:           mk("Templates",          "#2D6A4F"),
  audio:               mk("Audio",              "#0D6470"),
  prompt_packs:        mk("Prompt Packs",       "#6C3AD1"),
  "financial planners":mk("Financial Planners", "#1A6B3A"),
  leadership:          mk("Leadership",         "#A85E00"),
  purpose:             mk("Purpose",            "#7B1F3A"),
  business:            mk("Business",           "#2E5B8A"),
};

// Route pathname → theme. Longest/most specific first.
export const THEME_MAP: Array<{ match: RegExp; theme: ThemeTokens }> = [
  { match: /^\/$/,                 theme: mk("Home",          GOLD_ON_WHITE) },
  { match: /^\/dashboard\/new/,    theme: mk("Publish",       "#1A6B3A") },
  { match: /^\/dashboard/,         theme: mk("Dashboard",     GOLD_ON_WHITE) },
  { match: /^\/products/,          theme: mk("Browse",        GOLD_ON_WHITE) },
  { match: /^\/kingdom-picks/,     theme: mk("Kingdom Picks", GOLD_ON_WHITE) },
  { match: /^\/search/,            theme: mk("Search",        "#3A4A5C") },
  { match: /^\/wishlist/,          theme: mk("Wishlist",      "#7B1F3A") },
  { match: /^\/cart|^\/checkout/,  theme: mk("Cart",          GOLD_ON_WHITE) },
  { match: /^\/account/,           theme: mk("Account",       GOLD_ON_WHITE) },
  { match: /^\/auth/,              theme: mk("Sign In",       "#2E5B8A") },
  { match: /^\/admin/,             theme: mk("Admin",         "#B8560B") },
  { match: /^\/sell/,              theme: mk("Sell",          GOLD_ON_WHITE) },
  { match: /^\/support|^\/contact|^\/about|^\/terms|^\/privacy|^\/creator-agreement|^\/affiliate-disclosure/,
    theme: mk("Info", "#3A4A5C") },
];

export const DEFAULT_THEME: ThemeTokens = mk("Home", GOLD_ON_WHITE);


export function resolveThemeForPath(pathname: string, search?: Record<string, unknown> | string): ThemeTokens {
  // Category overrides only apply on /products
  if (/^\/products/.test(pathname)) {
    let category: string | undefined;
    if (typeof search === "string") {
      const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
      category = params.get("category") ?? undefined;
    } else if (search && typeof search === "object") {
      const raw = (search as Record<string, unknown>).category;
      if (typeof raw === "string") category = raw;
    }
    if (category) {
      const key = category.toLowerCase();
      if (CATEGORY_THEMES[key]) return CATEGORY_THEMES[key];
    }
  }
  for (const entry of THEME_MAP) {
    if (entry.match.test(pathname)) return entry.theme;
  }
  return DEFAULT_THEME;
}
