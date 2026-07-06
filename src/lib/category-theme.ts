// Category color theming — derived from src/lib/categories.ts so every
// consumer (browse hero, badges, product detail) reads from a single source.

import { getCategoryDef, CATEGORIES } from "@/lib/categories";

export type CategoryTheme = {
  bg: string;
  ink: string;
  accent: string;
  border: string;
  pill: string;
  blurb: string;
  icon: string;
};

// Convert an accent hex to a translucent rgba().
function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const DEFAULT_DEF = CATEGORIES[0];

export function getCategoryTheme(category?: string | null): CategoryTheme {
  const def = getCategoryDef(category) ?? DEFAULT_DEF;
  return {
    bg: def.gradient,
    ink: def.ink,
    accent: def.accent,
    border: alpha(def.accent, 0.45),
    pill: alpha(def.accent, 0.14),
    blurb: def.blurb,
    icon: def.icon,
  };
}
