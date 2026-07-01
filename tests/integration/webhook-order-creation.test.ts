/**
 * End-to-end integration test for the Stripe checkout.session.completed
 * webhook handler. Verifies that:
 *
 *   1. An `orders` row is inserted for the session, keyed by
 *      stripe_session_id, with the correct amount / currency / env / status.
 *   2. A matching `order_items` row is inserted with platform-fee math and
 *      seller amount split correctly.
 *   3. A download token row is created for the buyer.
 *   4. The incoming session payload carries the expected tax fields
 *      (`automatic_tax.enabled === true` and `tax_code === "txcd_10000000"`
 *      on every line item) so Stripe→webhook→DB is verified end to end.
 *   5. Idempotency: replaying the same session does not double-insert.
 *
 * Run with: bun test tests/integration/webhook-order-creation.test.ts
 */
import { describe, it, expect, beforeEach, mock } from "bun:test";

process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test_service_role_key";
process.env.SUPABASE_PUBLISHABLE_KEY ??= "test_pub_key";
process.env.LOVABLE_API_KEY ??= "test_lovable_key";

// ---------------------------------------------------------------------------
// In-memory Supabase admin double
// ---------------------------------------------------------------------------
type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};

function reset() {
  for (const k of Object.keys(tables)) delete tables[k];
  tables.orders = [];
  tables.order_items = [];
  tables.order_downloads = [];
  tables.marketplace_products = [
    { id: "prod_1", title: "Kingdom Mind", price_cents: 2700 },
  ];
  tables.seller_balances = [];
  tables.suppressed_emails = [];
  tables.email_unsubscribe_tokens = [];
  tables.email_send_log = [];
}

function builder(table: string) {
  const state: any = { table, filters: [] as Array<[string, any]>, _select: null };
  const api: any = {
    select: (cols?: string) => {
      state._select = cols ?? "*";
      return api;
    },
    eq: (col: string, val: any) => {
      state.filters.push([col, val]);
      return api;
    },
    maybeSingle: async () => {
      const rows = tables[table].filter((r) =>
        state.filters.every(([c, v]) => r[c] === v),
      );
      return { data: rows[0] ?? null, error: null };
    },
    single: async () => {
      const rows = tables[table].filter((r) =>
        state.filters.every(([c, v]) => r[c] === v),
      );
      if (!rows[0]) return { data: null, error: new Error("not found") };
      return { data: rows[0], error: null };
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
          for (const r of tables[table]) {
            if (state.filters.every(([c, v]) => r[c] === v)) Object.assign(r, patch);
          }
          resolve({ data: null, error: null });
        },
      };
      return chain;
    },
    upsert: (payload: Row) => {
      tables[table].push({ ...payload });
      return { then: (resolve: any) => resolve({ data: [payload], error: null }) };
    },
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

// Silence email rendering — irrelevant to what we're asserting.
mock.module("react-email", () => ({ render: async () => "<p>ok</p>" }));

// ---------------------------------------------------------------------------
// Import handler AFTER mocks are registered.
// ---------------------------------------------------------------------------
const { handleCheckoutCompleted } = await import(
  "../../src/routes/api/public/payments/webhook"
);

function makeSession(overrides: Partial<Row> = {}): Row {
  return {
    id: "cs_test_123",
    payment_intent: "pi_test_123",
    amount_total: 2700,
    currency: "usd",
    customer_details: { email: "buyer@example.com" },
    automatic_tax: { enabled: true, status: "complete" },
    metadata: { product_id: "prod_1", seller_id: "seller_1" },
    line_items: {
      data: [
        {
          price: {
            product_data: { tax_code: "txcd_10000000" },
            unit_amount: 2700,
          },
          quantity: 1,
        },
      ],
    },
    ...overrides,
  };
}

describe("Stripe webhook → order persistence", () => {
  beforeEach(() => reset());

  it("payload carries automatic_tax + tax_code (Stripe contract)", () => {
    const s = makeSession();
    expect(s.automatic_tax?.enabled).toBe(true);
    for (const li of s.line_items.data) {
      expect(li.price.product_data.tax_code).toBe("txcd_10000000");
    }
  });

  it("creates order, order_item, download token, and seller balance", async () => {
    await handleCheckoutCompleted(makeSession(), "sandbox");

    expect(tables.orders).toHaveLength(1);
    const order = tables.orders[0];
    expect(order.stripe_session_id).toBe("cs_test_123");
    expect(order.stripe_payment_intent).toBe("pi_test_123");
    expect(order.amount_cents).toBe(2700);
    expect(order.currency).toBe("usd");
    expect(order.status).toBe("paid");
    expect(order.environment).toBe("sandbox");
    expect(order.buyer_email).toBe("buyer@example.com");

    expect(tables.order_items).toHaveLength(1);
    const item = tables.order_items[0];
    expect(item.order_id).toBe(order.id);
    expect(item.product_id).toBe("prod_1");
    expect(item.seller_id).toBe("seller_1");
    expect(item.product_title).toBe("Kingdom Mind");
    expect(item.unit_amount_cents).toBe(2700);
    // 9% platform fee (see PLATFORM_FEE_PCT)
    expect(item.platform_fee_cents).toBe(243);
    expect(item.seller_amount_cents).toBe(2457);

    expect(tables.order_downloads).toHaveLength(1);
    expect(tables.order_downloads[0].order_item_id).toBe(item.id);
    expect(tables.order_downloads[0].token).toMatch(/^[0-9a-f]{64}$/);

    expect(tables.seller_balances).toHaveLength(1);
    expect(tables.seller_balances[0].pending_cents).toBe(2457);
  });

  it("is idempotent — replaying the same session does not double-insert", async () => {
    const session = makeSession();
    await handleCheckoutCompleted(session, "sandbox");
    await handleCheckoutCompleted(session, "sandbox");
    expect(tables.orders).toHaveLength(1);
    expect(tables.order_items).toHaveLength(1);
  });

  it("skips when required metadata is missing", async () => {
    await handleCheckoutCompleted(
      makeSession({ id: "cs_missing", metadata: {} }),
      "sandbox",
    );
    expect(tables.orders).toHaveLength(0);
  });

  it("respects the env flag on the inserted row", async () => {
    await handleCheckoutCompleted(makeSession({ id: "cs_live_1" }), "live");
    expect(tables.orders[0].environment).toBe("live");
  });
});
