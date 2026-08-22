/**
 * Integration test for bundle checkout fulfillment.
 *
 * Verifies that a `checkout.session.completed` event carrying
 * `metadata.bundle_id` is exploded into one order_item per included product,
 * with the bundle price allocated pro-rata, a download token minted per line,
 * seller balances credited net of the platform fee, and idempotency preserved.
 *
 * Run with: bun test tests/integration/bundle-webhook-fulfillment.test.ts
 */
import { describe, it, expect, beforeEach, mock } from "bun:test";

process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test_service_role_key";
process.env.SUPABASE_PUBLISHABLE_KEY ??= "test_pub_key";
process.env.LOVABLE_API_KEY ??= "test_lovable_key";

type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};

function reset() {
  for (const k of Object.keys(tables)) delete tables[k];
  tables.orders = [];
  tables.order_items = [];
  tables.order_downloads = [];
  tables.seller_balances = [];
  tables.merch_events = [];
  tables.suppressed_emails = [];
  tables.email_unsubscribe_tokens = [];
  tables.email_send_log = [];
  tables.marketplace_bundles = [
    { id: "bundle_1", name: "QA Creator OS Trio", price_cents: 9900 },
  ];
  tables.marketplace_bundle_items = [
    { bundle_id: "bundle_1", product_id: "p1", position: 0 },
    { bundle_id: "bundle_1", product_id: "p2", position: 1 },
    { bundle_id: "bundle_1", product_id: "p3", position: 2 },
  ];
  tables.marketplace_products = [
    { id: "p1", title: "Documentary Creator OS", price_cents: 6900, seller_id: "seller_a" },
    { id: "p2", title: "Reality Show Creator OS", price_cents: 6900, seller_id: "seller_a" },
    { id: "p3", title: "Streaming Pitch OS", price_cents: 2999, seller_id: "seller_b" },
  ];
}

function builder(table: string) {
  const state: any = { filters: [] as Array<[string, any]>, inFilter: null as null | [string, any[]] };
  const match = (r: Row) =>
    state.filters.every(([c, v]: [string, any]) => r[c] === v) &&
    (!state.inFilter || state.inFilter[1].includes(r[state.inFilter[0]]));
  const api: any = {
    select: () => api,
    eq: (col: string, val: any) => {
      state.filters.push([col, val]);
      return api;
    },
    in: (col: string, vals: any[]) => {
      state.inFilter = [col, vals];
      return api;
    },
    order: () => api,
    maybeSingle: async () => ({ data: tables[table].filter(match)[0] ?? null, error: null }),
    single: async () => {
      const r = tables[table].filter(match)[0];
      return r ? { data: r, error: null } : { data: null, error: new Error("not found") };
    },
    insert: (payload: Row | Row[]) => {
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const r of rows) {
        r.id = r.id ?? `${table}_${tables[table].length + 1}`;
        tables[table].push({ ...r });
      }
      return {
        select: () => ({
          single: async () => ({ data: tables[table][tables[table].length - 1], error: null }),
        }),
        then: (resolve: any) => resolve({ data: rows, error: null }),
      };
    },
    update: (patch: Row) => {
      const chain: any = {
        eq: (col: string, val: any) => {
          state.filters.push([col, val]);
          return chain;
        },
        is: () => chain,
        then: (resolve: any) => {
          for (const r of tables[table]) if (match(r)) Object.assign(r, patch);
          resolve({ data: null, error: null });
        },
      };
      return chain;
    },
    upsert: (payload: Row) => {
      tables[table].push({ ...payload });
      return { then: (resolve: any) => resolve({ data: [payload], error: null }) };
    },
    // Allow `await sb.from(...).select(...).in(...)` to resolve directly.
    then: (resolve: any) => resolve({ data: tables[table].filter(match), error: null }),
  };
  return api;
}

const supabaseAdmin = {
  from: (t: string) => {
    tables[t] ??= [];
    return builder(t);
  },
  rpc: async () => ({ data: null, error: null }),
};

mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin }));
mock.module("react-email", () => ({ render: async () => "<p>ok</p>" }));

const { handleCheckoutCompleted } = await import(
  "../../src/routes/api/public/payments/webhook"
);

function makeBundleSession(overrides: Partial<Row> = {}): Row {
  return {
    id: "cs_bundle_1",
    payment_intent: "pi_bundle_1",
    amount_total: 9900,
    currency: "usd",
    customer_details: { email: "buyer@example.com" },
    metadata: { bundle_id: "bundle_1" },
    ...overrides,
  };
}

describe("bundle checkout → fulfillment", () => {
  beforeEach(() => reset());

  it("explodes the bundle into one order item per product with allocated prices", async () => {
    await handleCheckoutCompleted(makeBundleSession(), "sandbox");

    expect(tables.orders).toHaveLength(1);
    const order = tables.orders[0];
    expect(order.amount_cents).toBe(9900);
    expect(order.status).toBe("paid");
    expect(order.environment).toBe("sandbox");

    expect(tables.order_items).toHaveLength(3);
    const sum = tables.order_items.reduce((a, r) => a + r.unit_amount_cents, 0);
    expect(sum).toBe(9900);
    for (const item of tables.order_items) {
      expect(item.order_id).toBe(order.id);
      expect(item.bundle_id).toBe("bundle_1");
      expect(item.bundle_name).toBe("QA Creator OS Trio");
      expect(item.unit_amount_cents).toBeGreaterThan(0);
      // 15% platform fee retained by AurumVault
      expect(item.platform_fee_cents).toBe(Math.round(item.unit_amount_cents * 0.15));
      expect(item.seller_amount_cents).toBe(
        item.unit_amount_cents - item.platform_fee_cents,
      );
    }
  });

  it("mints one download token per included product", async () => {
    await handleCheckoutCompleted(makeBundleSession(), "sandbox");
    expect(tables.order_downloads).toHaveLength(3);
    const itemIds = tables.order_items.map((i) => i.id);
    for (const d of tables.order_downloads) {
      expect(itemIds).toContain(d.order_item_id);
      expect(d.token).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("credits each seller their net share", async () => {
    await handleCheckoutCompleted(makeBundleSession(), "sandbox");
    const bySeller = new Map(
      tables.seller_balances.map((b) => [b.seller_id, b.pending_cents]),
    );
    expect(bySeller.size).toBe(2);
    const expected = new Map<string, number>();
    for (const i of tables.order_items) {
      const sellerId = i.seller_id;
      expected.set(sellerId, (expected.get(sellerId) ?? 0) + i.seller_amount_cents);
    }
    for (const [sellerId, cents] of expected) {
      expect(bySeller.get(sellerId)).toBe(cents);
    }
  });

  it("logs a merchandising purchase event for the bundle", async () => {
    await handleCheckoutCompleted(makeBundleSession(), "sandbox");
    expect(tables.merch_events).toHaveLength(1);
    expect(tables.merch_events[0].kind).toBe("purchase");
    expect(tables.merch_events[0].bundle_id).toBe("bundle_1");
    expect(tables.merch_events[0].amount_cents).toBe(9900);
  });

  it("is idempotent — replaying the session does not double-fulfil", async () => {
    const s = makeBundleSession();
    await handleCheckoutCompleted(s, "sandbox");
    await handleCheckoutCompleted(s, "sandbox");
    expect(tables.orders).toHaveLength(1);
    expect(tables.order_items).toHaveLength(3);
    expect(tables.order_downloads).toHaveLength(3);
  });

  it("skips when the bundle no longer exists", async () => {
    tables.marketplace_bundles = [];
    await handleCheckoutCompleted(makeBundleSession({ id: "cs_missing" }), "sandbox");
    expect(tables.order_items).toHaveLength(0);
  });
});
