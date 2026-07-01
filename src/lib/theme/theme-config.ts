export type ThemeTokens = {
  tabName: string;
  accentColor: string;
  gradientStart: string;
  gradientEnd: string; // always near black
};

// Near-black anchor used by every gradient
const BLACK = "#0A0A0A";

// Route → theme map. Longest prefix wins.
export const THEME_MAP: Array<{ match: RegExp; theme: ThemeTokens }> = [
  { match: /^\/$/,                theme: { tabName: "Home",         accentColor: "#D4AF37", gradientStart: "#0F1E35", gradientEnd: BLACK } },
  { match: /^\/products/,         theme: { tabName: "eBooks",       accentColor: "#D4AF37", gradientStart: "#1A2B4A", gradientEnd: BLACK } },
  { match: /^\/vault/,            theme: { tabName: "Vault",        accentColor: "#C9A24A", gradientStart: "#2A1F0F", gradientEnd: BLACK } },
  { match: /^\/kingdom-picks/,    theme: { tabName: "Kingdom",      accentColor: "#E6C25A", gradientStart: "#2B1A3A", gradientEnd: BLACK } },
  { match: /^\/search/,           theme: { tabName: "Search",       accentColor: "#7FB3FF", gradientStart: "#0E2140", gradientEnd: BLACK } },
  { match: /^\/wishlist/,         theme: { tabName: "Wishlist",     accentColor: "#F2A5B3", gradientStart: "#3A0F1F", gradientEnd: BLACK } },
  { match: /^\/cart|^\/checkout/, theme: { tabName: "Cart",         accentColor: "#7BE0A5", gradientStart: "#0F2A22", gradientEnd: BLACK } },
  { match: /^\/account|^\/auth/,  theme: { tabName: "Account",      accentColor: "#D4AF37", gradientStart: "#0F1E35", gradientEnd: BLACK } },
  { match: /^\/dashboard/,        theme: { tabName: "Dashboard",    accentColor: "#D4AF37", gradientStart: "#1A2B4A", gradientEnd: BLACK } },
  { match: /^\/admin/,            theme: { tabName: "Admin",        accentColor: "#FF9F5A", gradientStart: "#2A180F", gradientEnd: BLACK } },
  { match: /^\/sell/,             theme: { tabName: "Sell",         accentColor: "#D4AF37", gradientStart: "#1A2B4A", gradientEnd: BLACK } },
  { match: /^\/support|^\/contact|^\/about|^\/terms|^\/privacy|^\/creator-agreement|^\/affiliate-disclosure/,
    theme: { tabName: "Info",     accentColor: "#B8C4D8", gradientStart: "#141E2E", gradientEnd: BLACK } },
];

export const DEFAULT_THEME: ThemeTokens = {
  tabName: "Home",
  accentColor: "#D4AF37",
  gradientStart: "#0F1E35",
  gradientEnd: BLACK,
};

export function resolveThemeForPath(pathname: string): ThemeTokens {
  for (const entry of THEME_MAP) {
    if (entry.match.test(pathname)) return entry.theme;
  }
  return DEFAULT_THEME;
}
