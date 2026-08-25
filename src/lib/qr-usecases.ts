/**
 * AurumVault QR Business System — Phase 2 outcome-first configuration.
 *
 * Pure data + pure helpers only (no Supabase, no React, no rendering) so
 * both the create wizard and the server functions read the SAME
 * authoritative list. The server re-validates every use_case / niche /
 * placement value against these lists before any write — the UI's picker is
 * convenience, never the source of truth.
 *
 * Phase 2 language rule: a business owner picks a GOAL ("get more reviews"),
 * not a technical destination type. Each goal maps to the underlying Phase 1
 * destination type, which stays an implementation detail.
 */

import type { QrDestinationType } from "./qr";

export const QR_USE_CASES = [
  "storefront",
  "product",
  "reviews",
  "contact",
  "call",
  "text",
  "socials",
  "booking",
  "menu",
  "signup",
  "other",
] as const;
export type QrUseCase = (typeof QR_USE_CASES)[number];

export const QR_NICHES = ["general", "real_estate", "creator", "beauty"] as const;
export type QrNiche = (typeof QR_NICHES)[number];

export type UseCaseMeta = {
  /** Outcome-first label — what the business owner wants to happen. */
  label: string;
  /** One plain-language sentence: what a person scanning it experiences. */
  outcome: string;
  destinationType: Exclude<QrDestinationType, "text">;
  /** Suggested QR name, pre-filled so a first-time user never faces a blank field. */
  suggestedName: string;
  /** Suggested placements — these seed the placement-tracking picker. */
  placements: string[];
  /** True when AurumVault can fill the destination in for you (shortcuts). */
  shortcut?: "storefront" | "product";
};

export const USE_CASE_META: Record<QrUseCase, UseCaseMeta> = {
  storefront: {
    label: "Send people to my AurumVault storefront",
    outcome: "Your storefront opens, with everything you sell in one place.",
    destinationType: "url",
    suggestedName: "My storefront",
    placements: ["Business card", "Packaging insert", "Event table", "Window decal"],
    shortcut: "storefront",
  },
  product: {
    label: "Promote one specific product",
    outcome: "That product's page opens, ready to buy.",
    destinationType: "url",
    suggestedName: "Product promo",
    placements: ["Flyer", "Packaging insert", "Ad card", "Event table"],
    shortcut: "product",
  },
  reviews: {
    label: "Ask for a review",
    outcome: "Your review page opens so they can leave feedback on the spot.",
    destinationType: "url",
    suggestedName: "Leave us a review",
    placements: ["Receipt", "Thank-you card", "Counter sign", "Packaging insert"],
  },
  contact: {
    label: "Let people email me",
    outcome: "Their email app opens with your address already filled in.",
    destinationType: "email",
    suggestedName: "Email us",
    placements: ["Business card", "Yard sign", "Brochure"],
  },
  call: {
    label: "Let people call me",
    outcome: "Their phone dialer opens with your number ready.",
    destinationType: "tel",
    suggestedName: "Call us",
    placements: ["Yard sign", "Vehicle decal", "Business card", "Door hanger"],
  },
  text: {
    label: "Let people text me",
    outcome: "Their messaging app opens with your number ready.",
    destinationType: "sms",
    suggestedName: "Text us",
    placements: ["Yard sign", "Counter sign", "Flyer"],
  },
  socials: {
    label: "Grow my following",
    outcome: "Your social profile or link page opens.",
    destinationType: "url",
    suggestedName: "Follow us",
    placements: ["Packaging insert", "Event table", "Screen overlay", "Business card"],
  },
  booking: {
    label: "Get bookings or appointments",
    outcome: "Your booking page opens so they can pick a time.",
    destinationType: "url",
    suggestedName: "Book an appointment",
    placements: ["Counter sign", "Chair-back card", "Business card", "Door decal"],
  },
  menu: {
    label: "Show my menu, catalog, or price list",
    outcome: "Your current menu or price list opens — update it any time.",
    destinationType: "url",
    suggestedName: "Our menu",
    placements: ["Table tent", "Window decal", "Counter sign"],
  },
  signup: {
    label: "Collect emails or leads",
    outcome: "Your signup form opens.",
    destinationType: "url",
    suggestedName: "Join our list",
    placements: ["Event table", "Flyer", "Packaging insert", "Screen overlay"],
  },
  other: {
    label: "Something else",
    outcome: "Goes wherever you point it.",
    destinationType: "url",
    suggestedName: "My QR code",
    placements: ["Print", "Signage", "Online"],
  },
};

export type NicheKit = {
  label: string;
  /** Who this kit is for, in the owner's own words. */
  audience: string;
  /** Ordered, opinionated starting set — the "kit" itself. */
  useCases: QrUseCase[];
  /** Placement ideas specific to this industry, shown alongside the goal's own. */
  placements: string[];
};

export const NICHE_KITS: Record<QrNiche, NicheKit> = {
  general: {
    label: "General business",
    audience: "Any business getting started with QR codes.",
    useCases: ["storefront", "product", "reviews", "contact", "call"],
    placements: ["Business card", "Flyer", "Window decal", "Receipt"],
  },
  real_estate: {
    label: "Real estate",
    audience: "Agents and brokers marketing listings and open houses.",
    useCases: ["booking", "call", "text", "storefront", "signup"],
    placements: [
      "Yard sign",
      "Open house flyer",
      "Window rider",
      "Business card",
      "Just-listed mailer",
    ],
  },
  creator: {
    label: "Creator & digital seller",
    audience: "Creators selling digital products and growing an audience.",
    useCases: ["storefront", "product", "socials", "signup", "reviews"],
    placements: [
      "Packaging insert",
      "Screen overlay",
      "Event table",
      "Print zine",
      "Conference badge",
    ],
  },
  beauty: {
    label: "Beauty & personal care",
    audience: "Salons, stylists, estheticians, and barbers.",
    useCases: ["booking", "reviews", "socials", "call", "menu"],
    placements: [
      "Chair-back card",
      "Mirror decal",
      "Front desk sign",
      "Appointment card",
      "Retail shelf tag",
    ],
  },
};

export function isQrUseCase(value: unknown): value is QrUseCase {
  return typeof value === "string" && (QR_USE_CASES as readonly string[]).includes(value);
}

export function isQrNiche(value: unknown): value is QrNiche {
  return typeof value === "string" && (QR_NICHES as readonly string[]).includes(value);
}

/**
 * Placement suggestions for a goal within a kit: the industry's own ideas
 * first (they're more specific), then the goal's generic ones, de-duplicated.
 */
export function suggestedPlacements(useCase: QrUseCase, niche: QrNiche): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [...NICHE_KITS[niche].placements, ...USE_CASE_META[useCase].placements]) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** The destination type a goal implies — owners never pick this themselves. */
export function destinationTypeForUseCase(useCase: QrUseCase): Exclude<QrDestinationType, "text"> {
  return USE_CASE_META[useCase].destinationType;
}

/** Normalize a free-text placement label, or null when it's effectively empty. */
export function normalizePlacementLabel(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = input.replace(/[\x00-\x1f\x7f]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 80);
}
