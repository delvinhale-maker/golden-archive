import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted: any[] = [];
const upserts: any[] = [];
let insertError: any = null;
let currentRow: any = null;

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      return {
        insert(row: any) {
          inserted.push({ table, row });
          return Promise.resolve({ error: insertError });
        },
        select() {
          return {
            eq() {
              return {
                maybeSingle: () => Promise.resolve({ data: currentRow, error: null }),
              };
            },
          };
        },
        upsert(row: any, opts: any) {
          upserts.push({ table, row, opts });
          return Promise.resolve({ error: null });
        },
      };
    },
  },
}));

vi.mock("@/lib/stripe.server", () => ({
  createStripeClient: () => ({
    customers: {
      retrieve: async () => ({ id: "cus_x", metadata: { userId: "user-1" } }),
    },
    subscriptions: { retrieve: async () => ({}) },
  }),
}));

import {
  claimBillingEvent,
  syncWalletSubscription,
} from "@/lib/license-wallet-billing.server";

function subscription(overrides: Record<string, any> = {}) {
  return {
    id: "sub_1",
    customer: "cus_x",
    status: "active",
    metadata: { userId: "user-1" },
    items: {
      data: [
        {
          current_period_end: 1_800_000_000,
          price: { lookup_key: "license_wallet_business_monthly" },
        },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  inserted.length = 0;
  upserts.length = 0;
  insertError = null;
  currentRow = null;
});

describe("webhook idempotency", () => {
  it("claims a fresh event id once", async () => {
    expect(await claimBillingEvent("evt_1", "customer.subscription.created", "sandbox")).toBe(
      true,
    );
    expect(inserted[0].table).toBe("license_wallet_billing_events");
    expect(inserted[0].row.event_id).toBe("evt_1");
  });

  it("refuses a duplicate event id (unique violation)", async () => {
    insertError = { code: "23505", message: "duplicate key" };
    expect(await claimBillingEvent("evt_1", "customer.subscription.created", "sandbox")).toBe(
      false,
    );
  });
});

describe("entitlement sync from Stripe objects", () => {
  it("activates the plan derived from the price lookup key", async () => {
    await syncWalletSubscription(subscription(), "sandbox");
    expect(upserts).toHaveLength(1);
    expect(upserts[0].row).toMatchObject({
      user_id: "user-1",
      plan: "BUSINESS",
      status: "active",
      stripe_subscription_id: "sub_1",
      stripe_customer_id: "cus_x",
      price_lookup_key: "license_wallet_business_monthly",
      environment: "sandbox",
    });
    expect(upserts[0].opts).toEqual({ onConflict: "user_id" });
  });

  it("downgrades to FREE when the subscription is deleted", async () => {
    await syncWalletSubscription(subscription(), "sandbox", { forceCanceled: true });
    expect(upserts[0].row).toMatchObject({ plan: "FREE", status: "canceled" });
  });

  it("ignores non-wallet subscriptions entirely", async () => {
    await syncWalletSubscription(
      subscription({ items: { data: [{ price: { lookup_key: "pro_monthly" } }] } }),
      "sandbox",
    );
    expect(upserts).toHaveLength(0);
  });

  it("falls back to the Stripe Customer's userId metadata, not client input", async () => {
    await syncWalletSubscription(subscription({ metadata: {} }), "sandbox");
    expect(upserts[0].row.user_id).toBe("user-1");
  });
});

describe("environment isolation", () => {
  it("ignores a sandbox event when the stored entitlement is live", async () => {
    currentRow = { environment: "live" };
    await syncWalletSubscription(subscription(), "sandbox");
    expect(upserts).toHaveLength(0);
  });

  it("allows a live event to take over a sandbox row", async () => {
    currentRow = { environment: "sandbox" };
    await syncWalletSubscription(subscription(), "live");
    expect(upserts).toHaveLength(1);
    expect(upserts[0].row.environment).toBe("live");
  });
});