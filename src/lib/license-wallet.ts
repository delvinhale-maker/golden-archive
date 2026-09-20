/**
 * AurumVault Business Certificate & License Wallet™ — pure domain module.
 *
 * Dependency-free (no zod, no Supabase, no React) so it is directly unit
 * testable and safe to import from both client and server code. Holds the
 * single source of truth for categories, derived expiration status, reminder
 * lead times, and plan/entitlement limits.
 *
 * BILLING NOTE: AurumVault's Stripe integration is a one-time marketplace
 * checkout system — there is no existing recurring-subscription table or tier
 * abstraction to extend (the same finding already documented in
 * rights-passport-plans.ts). This module therefore defines the plan +
 * entitlement boundary only; prices below are display/config values, and no
 * recurring checkout is wired.
 */

export const LICENSE_WALLET_CATEGORIES = [
  "INSURANCE_CERTIFICATE",
  "BUSINESS_LICENSE",
  "PROFESSIONAL_LICENSE",
  "PERMIT",
  "DBA_ASSUMED_NAME",
  "REGISTRATION",
  "CERTIFICATE",
  "INSPECTION_RECORD",
  "OTHER",
] as const;

export type LicenseWalletCategory = (typeof LICENSE_WALLET_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<LicenseWalletCategory, string> = {
  INSURANCE_CERTIFICATE: "Insurance Certificate",
  BUSINESS_LICENSE: "Business License",
  PROFESSIONAL_LICENSE: "Professional License",
  PERMIT: "Permit",
  DBA_ASSUMED_NAME: "DBA / Assumed Name",
  REGISTRATION: "Registration",
  CERTIFICATE: "Certificate",
  INSPECTION_RECORD: "Inspection Record",
  OTHER: "Other",
};

export function isLicenseWalletCategory(v: unknown): v is LicenseWalletCategory {
  return typeof v === "string" && (LICENSE_WALLET_CATEGORIES as readonly string[]).includes(v);
}

/* ---------------------------------------------------------------- uploads */

export const WALLET_ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const WALLET_ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"] as const;

/** Matches the private bucket's own 10 MB limit. */
export const WALLET_MAX_BYTES = 10 * 1024 * 1024;

export const WALLET_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export function walletFileError(name: string, type: string, size: number): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const extOk = (WALLET_ALLOWED_EXT as readonly string[]).includes(ext);
  const mimeOk = (WALLET_ALLOWED_MIME as readonly string[]).includes(type);
  if (!extOk) return "Only PDF, JPG, JPEG and PNG files are supported.";
  if (type && !mimeOk) return "The file contents don't match a PDF or image.";
  if (size <= 0) return "That file is empty.";
  if (size > WALLET_MAX_BYTES) return "Files must be 10 MB or smaller.";
  return null;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ---------------------------------------------------------------- status */

export type WalletStatus = "CURRENT" | "EXPIRING_SOON" | "EXPIRED" | "NO_EXPIRATION";

export const EXPIRING_SOON_DAYS = 30;

export const STATUS_LABELS: Record<WalletStatus, string> = {
  CURRENT: "Current",
  EXPIRING_SOON: "Expiring Soon",
  EXPIRED: "Expired",
  NO_EXPIRATION: "No Expiration",
};

/** Whole days between two YYYY-MM-DD dates, UTC-normalised (no timezone drift). */
export function daysUntil(expiration: string, today: string): number {
  const a = Date.parse(`${expiration.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN;
  return Math.round((a - b) / 86_400_000);
}

export function computeWalletStatus(
  doc: { expiration_date?: string | null; no_expiration?: boolean | null },
  today: string = new Date().toISOString().slice(0, 10),
): WalletStatus {
  if (doc.no_expiration || !doc.expiration_date) return "NO_EXPIRATION";
  const days = daysUntil(doc.expiration_date, today);
  if (Number.isNaN(days)) return "NO_EXPIRATION";
  if (days < 0) return "EXPIRED";
  if (days <= EXPIRING_SOON_DAYS) return "EXPIRING_SOON";
  return "CURRENT";
}

export type WalletStatusCounts = Record<WalletStatus, number>;

export function summarizeStatuses(
  docs: { expiration_date?: string | null; no_expiration?: boolean | null }[],
  today?: string,
): WalletStatusCounts {
  const counts: WalletStatusCounts = {
    CURRENT: 0,
    EXPIRING_SOON: 0,
    EXPIRED: 0,
    NO_EXPIRATION: 0,
  };
  for (const d of docs) counts[computeWalletStatus(d, today)] += 1;
  return counts;
}

/* -------------------------------------------------------------- reminders */

/** Lead times in days before expiration. `0` means "expired today". */
export const REMINDER_OFFSETS = [60, 30, 21, 14, 7, 3, 1, 0] as const;

export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

/**
 * The single reminder offset (if any) due for a document today. Returns null
 * when nothing is due. Callers pair this with the reminder log's unique
 * (document, offset, date) constraint for idempotency.
 */
export function dueReminderOffset(
  doc: { expiration_date?: string | null; no_expiration?: boolean | null },
  today: string,
): ReminderOffset | null {
  if (doc.no_expiration || !doc.expiration_date) return null;
  const days = daysUntil(doc.expiration_date, today);
  if (Number.isNaN(days)) return null;
  if (days < 0) return null;
  return (REMINDER_OFFSETS as readonly number[]).includes(days)
    ? (days as ReminderOffset)
    : null;
}

export function reminderSubject(title: string, offset: ReminderOffset): string {
  if (offset === 0) return `Expires today: ${title}`;
  return `Expires in ${offset} day${offset === 1 ? "" : "s"}: ${title}`;
}

/** Milestones enabled by default for a new wallet. */
export const DEFAULT_REMINDER_OFFSETS: readonly ReminderOffset[] = [30, 21, 7, 1];

export function reminderOffsetLabel(offset: ReminderOffset): string {
  if (offset === 0) return "Expiration day";
  return `${offset} day${offset === 1 ? "" : "s"} before`;
}

/**
 * Sanitises a stored/user-supplied milestone list: keeps only known offsets,
 * de-duplicates, and sorts longest lead time first. An empty selection is
 * honoured (the owner opted out of every milestone).
 */
export function normalizeReminderOffsets(value: unknown): ReminderOffset[] {
  if (!Array.isArray(value)) return [...DEFAULT_REMINDER_OFFSETS];
  const seen = new Set<number>();
  for (const raw of value) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if ((REMINDER_OFFSETS as readonly number[]).includes(n)) seen.add(n);
  }
  return (REMINDER_OFFSETS as readonly ReminderOffset[]).filter((o) => seen.has(o));
}

/** Whether a due milestone should actually be sent for this owner. */
export function isReminderMilestoneEnabled(
  offsets: readonly number[] | null | undefined,
  offset: ReminderOffset,
): boolean {
  if (offsets == null) return (DEFAULT_REMINDER_OFFSETS as readonly number[]).includes(offset);
  return offsets.includes(offset);
}


/* ------------------------------------------------------------------ plans */

export type WalletPlan = "FREE" | "SOLO" | "BUSINESS" | "MULTI_LOCATION";

export const DEFAULT_WALLET_PLAN: WalletPlan = "FREE";

export type WalletPlanConfig = {
  label: string;
  /** Monthly price in cents. 0 = included/free tier. */
  priceCents: number;
  maxDocuments: number;
  maxLocations: number;
  remindersEnabled: boolean;
};

export const WALLET_PLANS: Record<WalletPlan, WalletPlanConfig> = {
  FREE: {
    label: "Free Preview",
    priceCents: 0,
    maxDocuments: 3,
    maxLocations: 1,
    remindersEnabled: false,
  },
  SOLO: {
    label: "Solo",
    priceCents: 1200,
    maxDocuments: 25,
    maxLocations: 1,
    remindersEnabled: true,
  },
  BUSINESS: {
    label: "Business",
    priceCents: 2900,
    maxDocuments: 200,
    maxLocations: 5,
    remindersEnabled: true,
  },
  MULTI_LOCATION: {
    label: "Multi-Location",
    priceCents: 6900,
    maxDocuments: 2000,
    maxLocations: 50,
    remindersEnabled: true,
  },
};

export function isWalletPlan(v: unknown): v is WalletPlan {
  return typeof v === "string" && v in WALLET_PLANS;
}

export function formatPlanPrice(plan: WalletPlan): string {
  const cents = WALLET_PLANS[plan].priceCents;
  return cents === 0 ? "Included" : `$${(cents / 100).toFixed(0)}/month`;
}

/* --------------------------------------------------- billing boundary only */

/**
 * Recurring-subscription boundary. These are Stripe price *lookup keys*
 * (human-readable, stable across test/live) created through the built-in
 * Payments integration — never raw `price_...` ids, and never invented. A plan
 * with `null` here is unpurchasable and the UI must stay fail-closed.
 *
 * The canonical plan↔price mapping used by checkout and the webhook lives in
 * `license-wallet-billing.ts`; this constant keeps the display-side helpers
 * below truthful without adding an import cycle.
 */
export const WALLET_PLAN_PRICE_IDS: Record<Exclude<WalletPlan, "FREE">, string | null> = {
  SOLO: "license_wallet_solo_monthly",
  BUSINESS: "license_wallet_business_monthly",
  MULTI_LOCATION: "license_wallet_multi_location_monthly",
};

/** True only when a real recurring price ID is configured for the plan. */
export function walletPlanCheckoutEnabled(plan: WalletPlan): boolean {
  if (plan === "FREE") return false;
  return typeof WALLET_PLAN_PRICE_IDS[plan] === "string" && WALLET_PLAN_PRICE_IDS[plan]!.length > 0;
}

/** Any paid Wallet plan purchasable? Used to keep upgrade UI truthful. */
export function walletBillingConfigured(): boolean {
  return (Object.keys(WALLET_PLAN_PRICE_IDS) as Exclude<WalletPlan, "FREE">[]).some(
    walletPlanCheckoutEnabled,
  );
}



export type QuotaResult = { allowed: true } | { allowed: false; message: string };

export function checkDocumentQuota(plan: WalletPlan, currentCount: number): QuotaResult {
  const max = WALLET_PLANS[plan].maxDocuments;
  if (currentCount < max) return { allowed: true };
  return {
    allowed: false,
    message: `Your ${WALLET_PLANS[plan].label} plan includes ${max} documents. Upgrade to add more.`,
  };
}

export function checkLocationQuota(plan: WalletPlan, currentCount: number): QuotaResult {
  const max = WALLET_PLANS[plan].maxLocations;
  if (currentCount < max) return { allowed: true };
  return {
    allowed: false,
    message: `Your ${WALLET_PLANS[plan].label} plan includes ${max} location${max === 1 ? "" : "s"}. Upgrade to add more.`,
  };
}

/* --------------------------------------------------------------- activity */

export const ACTIVITY_LABELS: Record<string, string> = {
  CREATED: "Document added",
  UPDATED: "Details updated",
  DELETED: "Document deleted",
  FILE_REPLACED: "File replaced",
  FILE_VIEWED: "File viewed",
  LOCATION_SAVED: "Location saved",
  REMINDER_SETTINGS_SAVED: "Reminder settings saved",
};

export function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action;
}