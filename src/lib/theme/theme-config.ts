export type ThemeTokens = {
  tabName: string;
  accentColor: string;
  gradientStart: string;
  gradientEnd: string; // always near black
};

// Near-black anchor used by every gradient
const BLACK = "#0A0A0A";

const mk = (tabName: string, accentColor: string, gradientStart: string): ThemeTokens => ({
  tabName,
  accentColor,
  gradientStart,
  gradientEnd: BLACK,
});

// Category (?category=...) → theme, matched on /products
export const CATEGORY_THEMES: Record<string, ThemeTokens> = {
  ebooks:     mk("eBooks",     "#B8860B", "#0F1E35"),
  courses:    mk("Courses",    "#4B2D8F", "#1A0A2E"),
  templates:  mk("Templates",  "#2D6A4F", "#091A0F"),
  audio:      mk("Audio",      "#0D7A8A", "#091E22"),
  finance:    mk("Finance",    "#1A6B3A", "#091A0F"),
  leadership: mk("Leadership", "#C47B00", "#1A1000"),
  purpose:    mk("Purpose",    "#7B1F3A", "#1A0810"),
  business:   mk("Business",   "#2E5B8A", "#0A1220"),
};

// Route pathname → theme. Longest/most specific first.
export const THEME_MAP: Array<{ match: RegExp; theme: ThemeTokens }> = [
  { match: /^\/$/,                 theme: mk("Home",          "#B8860B", "#0F1E35") },
  { match: /^\/dashboard\/new/,    theme: mk("Publish",       "#1A6B3A", "#091A0F") },
  { match: /^\/dashboard/,         theme: mk("Dashboard",     "#B8860B", "#0F1E35") },
  { match: /^\/products/,          theme: mk("Browse",        "#B8860B", "#0F1E35") },
  { match: /^\/kingdom-picks/,     theme: mk("Kingdom Picks", "#B8860B", "#1A1400") },
  { match: /^\/search/,            theme: mk("Search",        "#3A4A5C", "#0D1117") },
  { match: /^\/wishlist/,          theme: mk("Wishlist",      "#7B1F3A", "#1A0810") },
  { match: /^\/cart|^\/checkout/,  theme: mk("Cart",          "#B8860B", "#0F1E35") },
  { match: /^\/account/,           theme: mk("Account",       "#B8860B", "#0F1E35") },
  { match: /^\/auth/,              theme: mk("Sign In",       "#2E5B8A", "#0A1220") },
  { match: /^\/admin/,             theme: mk("Admin",         "#FF9F5A", "#2A180F") },
  { match: /^\/sell/,              theme: mk("Sell",          "#B8860B", "#0F1E35") },
  { match: /^\/support|^\/contact|^\/about|^\/terms|^\/privacy|^\/creator-agreement|^\/affiliate-disclosure/,
    theme: mk("Info", "#B8C4D8", "#141E2E") },
];

export const DEFAULT_THEME: ThemeTokens = mk("Home", "#B8860B", "#0F1E35");

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
