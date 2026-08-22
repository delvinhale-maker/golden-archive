/**
 * Client-safe creator-storefront helpers: accent presets, slug normalization,
 * reserved-name guard, and outbound-link validation. Pure functions only so
 * they can be unit-tested and imported from both server and browser code.
 */

export const STOREFRONT_ACCENTS = [
  "gold",
  "emerald",
  "sapphire",
  "burgundy",
  "slate",
] as const;

export type StorefrontAccent = (typeof STOREFRONT_ACCENTS)[number];

export const DEFAULT_ACCENT: StorefrontAccent = "gold";

/** Max featured products a creator may pin to the top of their storefront. */
export const MAX_FEATURED_PRODUCTS = 6;

/** Static Tailwind class maps — mapped onto existing AurumVault design tokens. */
export const ACCENT_CLASSES: Record<
  StorefrontAccent,
  { label: string; text: string; bg: string; border: string; ring: string; chip: string }
> = {
  gold: {
    label: "Gold",
    text: "text-gold-ink",
    bg: "bg-gold",
    border: "border-gold",
    ring: "ring-gold",
    chip: "bg-gold/10 text-gold-ink border-gold/30",
  },
  emerald: {
    label: "Emerald",
    text: "text-accent-emerald",
    bg: "bg-accent-emerald",
    border: "border-accent-emerald",
    ring: "ring-accent-emerald",
    chip: "bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30",
  },
  sapphire: {
    label: "Sapphire",
    text: "text-accent-dusty",
    bg: "bg-accent-dusty",
    border: "border-accent-dusty",
    ring: "ring-accent-dusty",
    chip: "bg-accent-dusty/10 text-accent-dusty border-accent-dusty/30",
  },
  burgundy: {
    label: "Burgundy",
    text: "text-accent-burgundy",
    bg: "bg-accent-burgundy",
    border: "border-accent-burgundy",
    ring: "ring-accent-burgundy",
    chip: "bg-accent-burgundy/10 text-accent-burgundy border-accent-burgundy/30",
  },
  slate: {
    label: "Slate",
    text: "text-navy",
    bg: "bg-navy-2",
    border: "border-navy-2",
    ring: "ring-navy-2",
    chip: "bg-navy/5 text-navy border-navy/20",
  },
};

export function accentClasses(accent: string | null | undefined) {
  return ACCENT_CLASSES[normalizeAccent(accent)];
}

export function normalizeAccent(accent: string | null | undefined): StorefrontAccent {
  return (STOREFRONT_ACCENTS as readonly string[]).includes(accent ?? "")
    ? (accent as StorefrontAccent)
    : DEFAULT_ACCENT;
}

/**
 * Platform paths a creator storefront may never occupy. Mirrors the database
 * trigger `seller_applications_guard_brand_slug` — keep both lists in sync.
 */
export const RESERVED_STOREFRONT_SLUGS = [
  "admin",
  "support",
  "aurumvault",
  "aurum-vault",
  "checkout",
  "login",
  "logout",
  "creators",
  "creator",
  "account",
  "marketplace",
  "store",
  "stores",
  "auth",
  "api",
  "cart",
  "library",
  "dashboard",
  "products",
  "bundles",
  "academy",
  "search",
  "sell",
] as const;

export function normalizeStorefrontSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type SlugCheck = { ok: true; slug: string } | { ok: false; reason: string };

export function checkStorefrontSlug(input: string): SlugCheck {
  const slug = normalizeStorefrontSlug(input ?? "");
  if (slug.length < 3) return { ok: false, reason: "Use at least 3 letters or numbers." };
  if (slug.length > 48) return { ok: false, reason: "Keep it under 48 characters." };
  if ((RESERVED_STOREFRONT_SLUGS as readonly string[]).includes(slug)) {
    return { ok: false, reason: `"${slug}" is reserved by AurumVault.` };
  }
  return { ok: true, slug };
}

/**
 * Creator-supplied links are rendered on a public page, so only absolute https
 * URLs are accepted. Blocks javascript:, data:, and protocol-relative tricks.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || value.length > 400) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  return url.toString();
}

/** Keep only ids the creator actually owns — never trust the client's list. */
export function filterOwnedProductIds(
  requested: readonly string[],
  owned: readonly string[],
): string[] {
  const ownedSet = new Set(owned);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of requested) {
    if (!ownedSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_FEATURED_PRODUCTS) break;
  }
  return result;
}

/** AurumVault keeps 15% of gross; the creator earns 85%. */
export const CREATOR_SHARE = 0.85;

export function splitGross(grossCents: number) {
  const creatorEarningsCents = Math.round(grossCents * CREATOR_SHARE);
  return {
    grossCents,
    creatorEarningsCents,
    platformFeeCents: grossCents - creatorEarningsCents,
  };
}

export function conversionRate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}
