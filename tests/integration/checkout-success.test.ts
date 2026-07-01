/**
 * End-to-end integration test: both the single-product "Buy Now" flow and
 * the full-cart checkout flow return a Stripe client secret AND emit the
 * required tax fields — `product_data.tax_code` on every line item and
 * `automatic_tax: { enabled: true }` on the session — so Stripe no longer
 * rejects the session with "the product tax code is missing".
 *
 * Run with: bun test tests/integration/checkout-success.test.ts
 */
import { describe, it, expect, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Env stubs (required by stripe.server.ts getEnv())
// ---------------------------------------------------------------------------
process.env.STRIPE_SANDBOX_API_KEY ??= "test_sandbox_key";
process.env.STRIPE_LIVE_API_KEY ??= "test_live_key";
process.env.LOVABLE_API_KEY ??= "test_lovable_key";
process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_PUBLISHABLE_KEY ??= "test_pub_key";

// ---------------------------------------------------------------------------
// Capture the params handed to stripe.checkout.sessions.create.
// Force the "automatic" tax mode path (no managed_payments capability) so
// the assertions below can pin automatic_tax: { enabled: true } exactly.
// ---------------------------------------------------------------------------
let capturedParams: any[] = [];

function fakeStripe() {
  return {
    accounts: {
      retrieve: async () => ({ capabilities: {}, controller: {} }),
    },
    checkout: {
      sessions: {
        create: async (params: any) => {
          capturedParams.push(params);
          return { client_secret: "cs_test_end_to_end_ok" };
        },
      },
    },
  };
}

mock.module("@/lib/stripe.server", () => {
  class TaxModeConflictError extends Error {
    constructor(public mode: any, public offendingFields: any, public details: any) {
      super(`Tax mode conflict: ${mode} vs ${offendingFields.join(",")}`);
    }
  }
  return {
    createStripeClient: () => fakeStripe(),
    getConnectionApiKey: () => "fake",
    getStripeErrorMessage: (e: any) => e?.message ?? "err",
    TaxModeConflictError,
    assertTaxModeInvariant: (params: any, mode: "managed" | "automatic") => {
      const hm = params.managed_payments !== undefined;
      const ha = params.automatic_tax !== undefined;
      if (hm && ha) throw new TaxModeConflictError(mode, ["both"], {});
    },
    detectTaxMode: async () => "automatic" as const,
    applyTaxMode: (params: any, mode: "managed" | "automatic") => {
      if (mode === "managed") params.managed_payments = { enabled: true };
      else params.automatic_tax = { enabled: true };
      return params;
    },
    extractStripeIds: (e: any) => ({ message: e?.message }),
    summarizeSessionShape: () => ({}),
  };
});

// Mock Supabase used inside payments.functions.ts for product lookups.
const cartRows = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Kingdom Mind",
    price_cents: 1499,
    seller_id: "seller-1",
    status: "approved",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    title: "Money Smart",
    price_cents: 999,
    seller_id: "seller-1",
    status: "approved",
  },
];
const singleRow = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Kingdom Mind",
  price_cents: 1499,
  seller_id: "seller-1",
  status: "approved",
  description: "A guide to renewing the mind.",
};

mock.module("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => {
      const q: any = {
        _data: null as any,
        select() { return q; },
        eq() { return q; },
        in() { q._data = cartRows; return q; },
        maybeSingle() { return Promise.resolve({ data: singleRow, error: null }); },
        then(resolve: any, reject: any) {
          return Promise.resolve({ data: q._data, error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  }),
}));

mock.module("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder: any = {
      inputValidator() { return builder; },
      middleware() { return builder; },
      handler(fn: any) {
        return (args: any) => fn({ data: args.data, context: {} });
      },
    };
    return builder;
  },
}));

mock.module("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
}));

const { createProductCheckout, createCartCheckout } = await import(
  "@/lib/payments.functions"
);

beforeEach(() => {
  capturedParams = [];
});

describe("checkout end-to-end: tax_code + automatic_tax", () => {
  it("Buy Now: succeeds and sends tax_code + automatic_tax to Stripe", async () => {
    const res = await createProductCheckout({
      data: {
        productId: "11111111-1111-1111-1111-111111111111",
        returnUrl: "https://www.aurumvault.store/checkout/return?session_id={CHECKOUT_SESSION_ID}",
        environment: "sandbox",
      },
    });

    // Session succeeds — clientSecret is returned to the frontend.
    expect(res).toEqual({ clientSecret: "cs_test_end_to_end_ok" });

    // Exactly one Stripe call, with the expected tax fields.
    expect(capturedParams).toHaveLength(1);
    const p = capturedParams[0];
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.managed_payments).toBeUndefined();
    expect(p.ui_mode).toBe("embedded_page");
    expect(p.mode).toBe("payment");

    // Every line item carries a Stripe tax_code.
    expect(p.line_items).toHaveLength(1);
    for (const li of p.line_items) {
      expect(li.price_data.product_data.tax_code).toBe("txcd_10000000");
      expect(li.price_data.tax_behavior).toBe("exclusive");
    }
  });

  it("Full cart: succeeds and sends tax_code on every item + automatic_tax on session", async () => {
    const res = await createCartCheckout({
      data: {
        items: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            title: "Kingdom Mind",
            priceCents: 1499,
            qty: 1,
          },
          {
            id: "22222222-2222-2222-2222-222222222222",
            title: "Money Smart",
            priceCents: 999,
            qty: 2,
          },
        ],
        returnUrl: "https://www.aurumvault.store/checkout/return?session_id={CHECKOUT_SESSION_ID}",
        environment: "sandbox",
      },
    });

    expect(res).toEqual({ clientSecret: "cs_test_end_to_end_ok" });

    expect(capturedParams).toHaveLength(1);
    const p = capturedParams[0];
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.managed_payments).toBeUndefined();
    expect(p.ui_mode).toBe("embedded_page");
    expect(p.mode).toBe("payment");

    expect(p.line_items).toHaveLength(2);
    for (const li of p.line_items) {
      expect(li.price_data.product_data.tax_code).toBe("txcd_10000000");
      expect(li.price_data.tax_behavior).toBe("exclusive");
      expect(li.price_data.product_data.name).toBeTruthy();
      expect(li.price_data.unit_amount).toBeGreaterThanOrEqual(50);
    }
  });
});
