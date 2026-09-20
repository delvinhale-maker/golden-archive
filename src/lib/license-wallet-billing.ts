/**
 * AurumVault Business Certificate & License Wallet™ — recurring billing map.
 *
 * Pure, dependency-free module: the ONLY source of truth for
 * plan → Stripe price lookup key and price lookup key → plan. Both the
 * checkout server function and the webhook entitlement sync resolve through
 * here, so the browser can never influence which plan a price grants.
 *
 * Price identifiers below are human-readable Stripe `lookup_key`s created
 * through Lovable's built-in Payments integration (stable across test/live).
 * Never accept a raw Stripe `price_...` id from client input.
 */
import { WALLET_PLANS, type WalletPlan } from "@/lib/license-wallet";

export type PaidWalletPlan = Exclude<WalletPlan, "FREE">;

export const WALLET_PAID_PLANS: readonly PaidWalletPlan[] = [
  "SOLO",
  "BUSINESS",
  "MULTI_LOCATION",
];

/** plan → price lookup key. `null` means "not configured / fail closed". */
export const WALLET_PLAN_PRICE_LOOKUP: Record<PaidWalletPlan, string | null> = {
  SOLO: "license_wallet_solo_monthly",
  BUSINESS: "license_wallet_business_monthly",
  MULTI_LOCATION: "license_wallet_multi_location_monthly",
};

/** Exact allowlist of accepted price lookup keys. */
export const WALLET_PRICE_LOOKUP_ALLOWLIST: readonly string[] = Object.values(
  WALLET_PLAN_PRICE_LOOKUP,
).filter((v): v is string => typeof v === "string" && v.length > 0);

export function isPaidWalletPlan(v: unknown): v is PaidWalletPlan {
  return typeof v === "string" && (WALLET_PAID_PLANS as readonly string[]).includes(v);
}

/** Resolve a plan to its configured price lookup key, or null (fail closed). */
export function priceLookupForPlan(plan: unknown): string | null {
  if (!isPaidWalletPlan(plan)) return null;
  const key = WALLET_PLAN_PRICE_LOOKUP[plan];
  return typeof key === "string" && key.length > 0 ? key : null;
}

/** Reverse map — server-side only source of truth for webhook sync. */
export function planForPriceLookup(lookupKey: unknown): PaidWalletPlan | null {
  if (typeof lookupKey !== "string" || !lookupKey) return null;
  for (const plan of WALLET_PAID_PLANS) {
    if (WALLET_PLAN_PRICE_LOOKUP[plan] === lookupKey) return plan;
  }
  return null;
}

export function walletPlanBillable(plan: unknown): boolean {
  return priceLookupForPlan(plan) !== null;
}

export function walletRecurringBillingConfigured(): boolean {
  return WALLET_PAID_PLANS.some(walletPlanBillable);
}

/** Monthly amount in cents for a paid plan — matches WALLET_PLANS pricing. */
export function planAmountCents(plan: PaidWalletPlan): number {
  return WALLET_PLANS[plan].priceCents;
}

/* -------------------------------------------------- subscription statuses */

/**
 * Stripe subscription status → wallet entitlement state.
 *
 * `active` / `trialing` grant the plan. `past_due` keeps access during the
 * legitimate dunning grace period (Stripe retries) but is recorded truthfully.
 * Everything terminal falls back to FREE.
 */
export type EntitlementSync = {
  plan: WalletPlan;
  /** Persisted status — constrained to active | past_due | canceled. */
  status: "active" | "past_due" | "canceled";
  /** Whether wallet paid entitlements are honoured. */
  entitled: boolean;
};

const GRANTING = new Set(["active", "trialing"]);
const GRACE = new Set(["past_due"]);

export function entitlementForSubscription(
  stripeStatus: string | null | undefined,
  plan: PaidWalletPlan | null,
): EntitlementSync {
  const status = (stripeStatus ?? "").toLowerCase();
  if (!plan) return { plan: "FREE", status: "canceled", entitled: false };
  if (GRANTING.has(status)) return { plan, status: "active", entitled: true };
  if (GRACE.has(status)) return { plan, status: "past_due", entitled: true };
  // canceled, unpaid, incomplete, incomplete_expired, paused → fail closed.
  return { plan: "FREE", status: "canceled", entitled: false };
}