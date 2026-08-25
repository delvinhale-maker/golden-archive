/**
 * AurumVault QR Business System — Phase 2 outcome config.
 *
 * Single source of truth for "what do you want people to do?" — the create
 * flow, niche pages, and any future outcome-labeled analytics all read from
 * this one map instead of restating the same strings. Adding a use case
 * later means adding one entry here, not touching four files.
 */

import type { QrDestinationType, QrMode } from "@/lib/qr";
import type { QrNicheId } from "@/lib/qr-niches";

export const QR_USE_CASE_IDS = [
  "website",
  "reviews",
  "booking",
  "email_list",
  "contact",
  "social_follow",
  "buy_product",
  "visit_store",
  "event_registration",
  "menu",
  "request_quote",
  "directions",
  "download_resource",
] as const;

export type QrUseCaseId = (typeof QR_USE_CASE_IDS)[number];

export type QrUseCase = {
  id: QrUseCaseId;
  label: string;
  description: string;
  destinationType: QrDestinationType;
  suggestedMode: QrMode;
  helperCopy: string;
  ctaExamples: string[];
  /** Niches this outcome is surfaced under in the Industry Kit selector. */
  supportedNiches: QrNicheId[];
};

export const QR_USE_CASES: Record<QrUseCaseId, QrUseCase> = {
  website: {
    id: "website",
    label: "Visit My Website",
    description: "Send people straight to your website or landing page.",
    destinationType: "url",
    suggestedMode: "dynamic",
    helperCopy: "Best as a dynamic QR — you can update the destination later without reprinting.",
    ctaExamples: ["Scan to visit our website.", "Learn more — scan here."],
    supportedNiches: ["small_business", "real_estate", "beauty_salon"],
  },
  reviews: {
    id: "reviews",
    label: "Get More Reviews",
    description: "Point people to your Google, Yelp, or other review page.",
    destinationType: "url",
    suggestedMode: "dynamic",
    helperCopy: "Dynamic is recommended — you can swap review platforms without a new code.",
    ctaExamples: ["Enjoyed your experience? Share your feedback.", "Scan to leave a review."],
    supportedNiches: ["small_business", "real_estate", "beauty_salon"],
  },
  booking: {
    id: "booking",
    label: "Book an Appointment",
    description: "Link to your existing booking or scheduling page.",
    destinationType: "url",
    suggestedMode: "dynamic",
    helperCopy: "Dynamic is recommended so you can change booking tools without reprinting.",
    ctaExamples: ["Scan to book your next appointment.", "Ready to book? Scan here."],
    supportedNiches: ["small_business", "real_estate", "beauty_salon"],
  },
  email_list: {
    id: "email_list",
    label: "Join My Email List",
    description: "Send people to your newsletter or email signup form.",
    destinationType: "url",
    suggestedMode: "dynamic",
    helperCopy: "Dynamic is recommended — track how many people scan to join.",
    ctaExamples: ["Scan to join the list.", "Get updates first — scan to subscribe."],
    supportedNiches: ["small_business", "real_estate", "creator", "beauty_salon"],
  },
  contact: {
    id: "contact",
    label: "Contact Me",
    description: "Start a call, text, or email straight from a scan.",
    destinationType: "tel",
    suggestedMode: "static",
    helperCopy:
      "Static works well here — a phone number rarely changes, so there's nothing to update later.",
    ctaExamples: ["Scan to call us.", "Questions? Scan to get in touch."],
    supportedNiches: ["small_business", "real_estate", "creator", "beauty_salon"],
  },
  social_follow: {
    id: "social_follow",
    label: "Follow My Social Media",
    description: "Link to your Instagram, TikTok, or other social profile.",
    destinationType: "url",
    suggestedMode: "dynamic",
    helperCopy: "Dynamic is recommended — swap platforms or profiles without a new code.",
    ctaExamples: ["Scan to follow us.", "Follow along — scan here."],
    supportedNiches: ["small_business", "creator", "beauty_salon"],
  },
  buy_product: {
    id: "buy_product",
    label: "Buy a Product",
    description: "Send people directly to a product page to purchase.",
    destinationType: "url",
    suggestedMode: "dynamic",
    helperCopy: "Dynamic is recommended — point to a different product later without reprinting.",
    ctaExamples: ["Scan to shop this product.", "Scan to buy now."],
    supportedNiches: ["creator"],
  },
  visit_store: {
    id: "visit_store",
    label: "Visit My Store",
    description: "Send people to your full storefront.",
    destinationType: "url",
    suggestedMode: "dynamic",
    helperCopy: "Dynamic is recommended — your storefront can grow without a new code.",
    ctaExamples: ["Scan to shop my digital products.", "Scan to browse my store."],
    supportedNiches: ["creator"],
  },
  event_registration: {
    id: "event_registration",
    label: "Register for an Event",
    description: "Link to an event registration or RSVP page.",
    destinationType: "url",
    suggestedMode: "dynamic",
    helperCopy: "Dynamic is recommended — reuse this code for the next event by updating the link.",
    ctaExamples: ["Scan to register.", "Save your spot — scan to RSVP."],
    supportedNiches: ["real_estate"],
  },
  menu: {
    id: "menu",
    label: "View a Menu",
    description: "Link to a digital menu or price list.",
    destinationType: "url",
    suggestedMode: "dynamic",
    helperCopy: "Dynamic is recommended — update prices or items without reprinting the code.",
    ctaExamples: ["Scan to view our menu.", "Scan for today's specials."],
    supportedNiches: ["small_business", "beauty_salon"],
  },
  request_quote: {
    id: "request_quote",
    label: "Request a Quote",
    description: "Link to a quote request or contact form.",
    destinationType: "url",
    suggestedMode: "dynamic",
    helperCopy: "Dynamic is recommended — point to an updated form without a new code.",
    ctaExamples: ["Scan to request a quote.", "Scan to get started."],
    supportedNiches: ["small_business", "real_estate"],
  },
  directions: {
    id: "directions",
    label: "Get Directions",
    description: "Link to a maps location for your business.",
    destinationType: "url",
    suggestedMode: "static",
    helperCopy: "Static works well here — a physical location rarely changes.",
    ctaExamples: ["Scan for directions.", "Find us — scan to open maps."],
    supportedNiches: ["small_business", "beauty_salon"],
  },
  download_resource: {
    id: "download_resource",
    label: "Download a Resource",
    description: "Link to a downloadable guide, media kit, or free resource.",
    destinationType: "url",
    suggestedMode: "dynamic",
    helperCopy: "Dynamic is recommended — swap the linked file later without reprinting.",
    ctaExamples: ["Scan to download.", "Scan to get the free guide."],
    supportedNiches: ["real_estate", "creator"],
  },
};

export function getQrUseCase(id: string): QrUseCase | undefined {
  return (QR_USE_CASES as Record<string, QrUseCase>)[id];
}
