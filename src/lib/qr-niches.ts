/**
 * AurumVault QR Business System — Phase 2 niche config ("Industry Kit").
 *
 * Each niche is just a curated, ordered list of use-case IDs from
 * qr-use-cases.ts — no duplicated outcome copy. Phase 2 intentionally ships
 * only these four niches (per the Phase 2 authorization); adding a fifth
 * later is one new entry here, not a new UI.
 */

import type { QrUseCaseId } from "@/lib/qr-use-cases";

export const QR_NICHE_IDS = ["small_business", "real_estate", "creator", "beauty_salon"] as const;

export type QrNicheId = (typeof QR_NICHE_IDS)[number];

export type QrNiche = {
  id: QrNicheId;
  label: string;
  description: string;
  useCaseIds: QrUseCaseId[];
};

export const QR_NICHES: Record<QrNicheId, QrNiche> = {
  small_business: {
    id: "small_business",
    label: "Small Business",
    description: "Everyday QR workflows for a local business.",
    // Covers: Reviews, Website, Booking, Email List, Services (→ menu),
    // Contact, Social, Request a Quote, Directions. "Current Offer" and
    // "Loyalty / Rewards" from the master prompt have no clean 1:1 mapping
    // onto the Phase 2 use-case set and are intentionally left out rather
    // than force-fit — see the Phase 2 report's noted ambiguities.
    useCaseIds: [
      "reviews",
      "website",
      "booking",
      "email_list",
      "menu",
      "contact",
      "social_follow",
      "request_quote",
      "directions",
    ],
  },
  real_estate: {
    id: "real_estate",
    label: "Real Estate",
    description: "QR workflows for listings, showings, and buyer follow-up.",
    // Covers: View Property (→ website), Schedule Showing (→ booking), Open
    // House Registration (→ event_registration), Buyer List (→ email_list),
    // Home Valuation (→ request_quote), Mortgage Information / Neighborhood
    // Guide / Property Guide (→ download_resource), Contact Agent (→
    // contact), Google Reviews (→ reviews).
    useCaseIds: [
      "website",
      "booking",
      "event_registration",
      "email_list",
      "request_quote",
      "download_resource",
      "contact",
      "reviews",
    ],
  },
  creator: {
    id: "creator",
    label: "Creator",
    description: "QR workflows for your AurumVault storefront and products.",
    // Covers: My AurumVault Store (→ visit_store, native shortcut), My
    // AurumVault Product (→ buy_product, native shortcut), Newsletter (→
    // email_list), Media Kit / Free Resource (→ download_resource), Social
    // Profile (→ social_follow), Work With Me / Brand Inquiry (→ contact).
    useCaseIds: [
      "visit_store",
      "buy_product",
      "email_list",
      "download_resource",
      "social_follow",
      "contact",
    ],
  },
  beauty_salon: {
    id: "beauty_salon",
    label: "Beauty / Salon",
    description: "QR workflows for booking, portfolio, and client follow-up.",
    // Covers: Book Appointment + Rebook (→ booking, distinguished via
    // placement_label, e.g. "Rebook Reminder"), View Services (→ menu),
    // View Portfolio (→ website), Follow Instagram (→ social_follow),
    // Google Reviews (→ reviews), Contact (→ contact), Get Directions (→
    // directions). "VIP List" (→ email_list) and "Refer a Friend" /
    // "Product Recommendations" (→ website) round out the list; the exact
    // page each links to is the salon's own choice.
    useCaseIds: [
      "booking",
      "menu",
      "website",
      "social_follow",
      "reviews",
      "email_list",
      "contact",
      "directions",
    ],
  },
};

export function getQrNiche(id: string): QrNiche | undefined {
  return (QR_NICHES as Record<string, QrNiche>)[id];
}
