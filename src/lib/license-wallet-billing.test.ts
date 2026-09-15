import { describe, expect, it } from "vitest";
import {
  WALLET_PAID_PLANS,
  WALLET_PRICE_LOOKUP_ALLOWLIST,
  entitlementForSubscription,
  isPaidWalletPlan,
  planAmountCents,
  planForPriceLookup,
  priceLookupForPlan,
  walletPlanBillable,
  walletRecurringBillingConfigured,
} from "@/lib/license-wallet-billing";
import { WALLET_PLANS, walletPlanCheckoutEnabled } from "@/lib/license-wallet";

describe("wallet plan ↔ price allowlist", () => {
  it("maps each paid plan to its configured recurring price lookup key", () => {
    expect(priceLookupForPlan("SOLO")).toBe("license_wallet_solo_monthly");
    expect(priceLookupForPlan("BUSINESS")).toBe("license_wallet_business_monthly");
    expect(priceLookupForPlan("MULTI_LOCATION")).toBe(
      "license_wallet_multi_location_monthly",
    );
  });

  it("round-trips price → plan for all three plans", () => {
    for (const plan of WALLET_PAID_PLANS) {
      expect(planForPriceLookup(priceLookupForPlan(plan))).toBe(plan);
    }
  });

  it("rejects FREE and unknown plans", () => {
    expect(priceLookupForPlan("FREE")).toBeNull();
    expect(priceLookupForPlan("ENTERPRISE")).toBeNull();
    expect(priceLookupForPlan(undefined)).toBeNull();
    expect(isPaidWalletPlan("FREE")).toBe(false);
    expect(walletPlanBillable("FREE")).toBe(false);
  });

  it("rejects arbitrary / raw Stripe price ids from client input", () => {
    expect(planForPriceLookup("price_1MoCkTest")).toBeNull();
    expect(planForPriceLookup("license_wallet_solo_monthly_v2")).toBeNull();
    expect(planForPriceLookup("")).toBeNull();
    expect(planForPriceLookup(null)).toBeNull();
    expect(WALLET_PRICE_LOOKUP_ALLOWLIST).toHaveLength(3);
  });

  it("keeps display helpers and billing map in agreement", () => {
    expect(walletRecurringBillingConfigured()).toBe(true);
    for (const plan of WALLET_PAID_PLANS) {
      expect(walletPlanCheckoutEnabled(plan)).toBe(walletPlanBillable(plan));
    }
    expect(walletPlanCheckoutEnabled("FREE")).toBe(false);
  });

  it("prices stay $12 / $29 / $69 per month", () => {
    expect(planAmountCents("SOLO")).toBe(1200);
    expect(planAmountCents("BUSINESS")).toBe(2900);
    expect(planAmountCents("MULTI_LOCATION")).toBe(6900);
  });

  it("preserves the Business 5-location entitlement", () => {
    expect(WALLET_PLANS.BUSINESS.maxLocations).toBe(5);
    expect(WALLET_PLANS.SOLO.maxLocations).toBe(1);
    expect(WALLET_PLANS.MULTI_LOCATION.maxLocations).toBe(50);
  });
});

describe("subscription status → entitlement", () => {
  it("grants the mapped plan on active and trialing", () => {
    for (const plan of WALLET_PAID_PLANS) {
      for (const status of ["active", "trialing"]) {
        expect(entitlementForSubscription(status, plan)).toEqual({
          plan,
          status: "active",
          entitled: true,
        });
      }
    }
  });

  it("keeps access during past_due dunning without downgrading", () => {
    expect(entitlementForSubscription("past_due", "BUSINESS")).toEqual({
      plan: "BUSINESS",
      status: "past_due",
      entitled: true,
    });
  });

  it("fails closed to FREE on terminal states", () => {
    for (const status of [
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
      "",
    ]) {
      expect(entitlementForSubscription(status, "MULTI_LOCATION")).toEqual({
        plan: "FREE",
        status: "canceled",
        entitled: false,
      });
    }
  });

  it("never grants a plan when the price is unmapped", () => {
    expect(entitlementForSubscription("active", null)).toEqual({
      plan: "FREE",
      status: "canceled",
      entitled: false,
    });
  });
});