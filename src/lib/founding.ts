/**
 * AurumVault Founding 100 — single source of truth for copy, limits, routes and
 * campaign attribution. Browser-safe: no server imports here.
 */
export const FOUNDING_COHORT_SIZE = 100;
export const FOUNDING_CAMPAIGN = "founding_100";
export const FOUNDING_ROUTE = "/founding-100";

/** Where founding applicants apply — the existing creator application. */
export const FOUNDING_APPLICATION_ROUTE = "/sell";

export const FOUNDING_EVENTS = {
  viewed: "founding_100_viewed",
  applyClicked: "founding_100_apply_clicked",
  starterPackClicked: "founding_100_starter_pack_clicked",
  faqOpened: "founding_100_faq_opened",
  launchKitViewed: "founding_100_launch_kit_viewed",
  launchKitCopied: "founding_100_launch_kit_copied",
} as const;

export const FOUNDING_BENEFITS = [
  {
    title: "Founding Creator status",
    body: "A permanent numbered Founding Creator mark on your storefront and product pages.",
  },
  {
    title: "You keep 85%",
    body: "The standard AurumVault split — 85% to you, 15% platform fee. No listing fees.",
  },
  {
    title: "Direct line to the team",
    body: "Founding creators get a direct channel for feedback that shapes the roadmap.",
  },
  {
    title: "Launch support",
    body: "A Launch Kit with announcement assets, caption copy and your storefront QR code.",
  },
  {
    title: "Early access",
    body: "New creator tools reach the founding cohort first, before general release.",
  },
  {
    title: "Curated marketplace",
    body: "A small, reviewed catalogue — your work sits next to quality, not noise.",
  },
] as const;

export const FOUNDING_LOOKING_FOR = [
  "You already make (or are close to finishing) a premium digital product.",
  "Your work is original, and you hold the rights to everything you sell.",
  "You care about presentation — covers, descriptions, and file quality.",
  "You're building something long term, not chasing one quick launch.",
] as const;

export const FOUNDING_FAQ = [
  {
    q: "What does Founding Creator actually mean?",
    a: "You're part of the first 100 creators accepted onto AurumVault. Your storefront carries a permanent numbered Founding Creator mark, and your feedback directly shapes what we build next.",
  },
  {
    q: "Is the application different from the normal one?",
    a: "No. You apply through the same creator application. Applying from this page tags your application to the Founding 100 campaign so we review it as part of the cohort.",
  },
  {
    q: "Does it cost anything?",
    a: "No. There is no fee to apply or to join. You keep 85% of every sale and we take a 15% platform fee.",
  },
  {
    q: "Am I guaranteed a spot?",
    a: "No. Every application is reviewed, and founding numbers are only assigned after approval. The cohort closes at 100 accepted creators.",
  },
  {
    q: "What happens after I'm accepted?",
    a: "You get your founding number, an email with next steps, and access to the Launch Kit in your creator dashboard so you can announce your storefront.",
  },
  {
    q: "Do my products get approved automatically?",
    a: "No. Every product still goes through the normal review for quality and rights. Founding status is about the cohort, not a shortcut past review.",
  },
] as const;

const STORAGE_KEY = "av_founding_attribution";

export type CampaignAttribution = {
  campaign: string;
  campaignSource: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referringUrl: string | null;
};

/** Captures the Founding 100 campaign + UTM context for later application attribution. */
export function captureFoundingAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const p = new URLSearchParams(window.location.search);
    const payload: CampaignAttribution = {
      campaign: FOUNDING_CAMPAIGN,
      campaignSource: p.get("src") ?? p.get("source"),
      utmSource: p.get("utm_source"),
      utmMedium: p.get("utm_medium"),
      utmCampaign: p.get("utm_campaign"),
      utmContent: p.get("utm_content"),
      utmTerm: p.get("utm_term"),
      referringUrl: document.referrer || null,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* attribution is best-effort */
  }
}

export function getStoredFoundingAttribution(): CampaignAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampaignAttribution;
    return parsed?.campaign === FOUNDING_CAMPAIGN ? parsed : null;
  } catch {
    return null;
  }
}

export function clearStoredFoundingAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** #007 style display for a founding number. */
export function formatFoundingNumber(n: number): string {
  return `#${String(n).padStart(3, "0")}`;
}
