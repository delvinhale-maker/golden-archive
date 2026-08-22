/**
 * Single source of truth for the AurumVault Digital Creator Starter Pack.
 *
 * Delivery decision: the pack is a small (~115KB) evergreen PDF served as a
 * public static asset from the app's own origin/CDN. No signed URLs (they
 * expire and would break evergreen emails) and no email attachments (hurts
 * deliverability and inflates every send). Download clicks are tracked
 * separately through the CTA analytics table instead of gating the file.
 */
export const STARTER_PACK_URL = "/downloads/AurumVault-Digital-Creator-Starter-Pack.pdf";
export const STARTER_PACK_FILENAME = "AurumVault-Digital-Creator-Starter-Pack.pdf";
export const STARTER_PACK_TITLE = "AurumVault Digital Creator Starter Pack";

/** Route users apply through — the existing creator application, not a new one. */
export const CREATOR_APPLICATION_ROUTE = "/sell";

/** Everything included in the pack, used on the landing page and in email copy. */
export const STARTER_PACK_CONTENTS = [
  "25 digital-product ideas",
  "Creator pricing worksheet",
  "Launch-readiness checklist",
  "30 content ideas",
  "Product-description formula",
  "Quality-control checklist",
  "10 AI prompts for creators",
  "7-Day Creator Sprint",
] as const;

/** Funnel event names logged through the existing CTA analytics table. */
export const STARTER_PACK_EVENTS = {
  viewed: "creator_starter_pack_viewed",
  formStarted: "creator_starter_pack_form_started",
  submitted: "creator_starter_pack_submitted",
  emailQueued: "creator_starter_pack_email_queued",
  downloadClicked: "creator_starter_pack_download_clicked",
  applicationClicked: "creator_application_clicked",
} as const;
