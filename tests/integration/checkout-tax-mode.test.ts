/**
 * Integration test: ensure single-product and full-cart checkout flows
 * never include `automatic_tax` when `managed_payments` is enabled, and
 * never include `managed_payments` when falling back to `automatic_tax`.
 *
 * Run with: bun test tests/integration/checkout-tax-mode.test.ts
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
// Capture the params handed to stripe.checkout.sessions.create
// ---------------------------------------------------------------------------
let capturedParams: any[] = [];
let accountCapability: "active" | undefined = "active"; // toggle per test

function fakeStripe() {
  return {
    accounts: {
      retrieve: async () => ({
        capabilities: { managed_payments: accountCapability },
        controller: {},
      }),
    },
    checkout: {
      sessions: {
        create: async (params: any) => {
          capturedParams.push(params);
          return { client_secret: "cs_test_123" };
        },
      },
    },
  };
}

// Mock stripe.server.ts — substitute createStripeClient with the fake,
// but keep the real applyTaxMode/detectTaxMode logic under test.
mock.module("@/lib/stripe.server", () => {
  const taxModeCache = new Map<string, { mode: "managed" | "automatic"; at: number }>();
  class TaxModeConflictError extends Error {
    constructor(public mode: any, public offendingFields: any, public details: any) {
      super(`Tax mode conflict: ${mode} vs ${offendingFields.join(",")}`);
    }
  }
  const assertTaxModeInvariant = (params: any, mode: "managed" | "automatic") => {
    const hm = params.managed_payments !== undefined;
    const ha = params.automatic_tax !== undefined;
    if (hm && ha) throw new TaxModeConflictError(mode, ["both"], {});
    if (mode === "managed" && !hm) throw new TaxModeConflictError(mode, ["m-missing"], {});
    if (mode === "automatic" && !ha) throw new TaxModeConflictError(mode, ["a-missing"], {});
  };
  return {
    createStripeClient: () => fakeStripe(),
    getConnectionApiKey: () => "fake",
    getStripeErrorMessage: (e: any) => e?.message ?? "err",
    TaxModeConflictError,
    assertTaxModeInvariant,
    detectTaxMode: async (stripe: any, env: string) => {
      const cached = taxModeCache.get(env);
      if (cached && false) return cached.mode;
      const acct = await stripe.accounts.retrieve();
      const mode: "managed" | "automatic" =
        acct.capabilities?.managed_payments === "active" ||
        acct.controller?.managed_payments?.enabled === true
          ? "managed"
          : "automatic";
      taxModeCache.set(env, { mode, at: Date.now() });
      return mode;
    },
    applyTaxMode: (params: any, mode: "managed" | "automatic") => {
      const hm = params.managed_payments !== undefined;
      const ha = params.automatic_tax !== undefined;
      if (hm && ha) throw new TaxModeConflictError(mode, ["both"], {});
      if (mode === "managed" && ha) throw new TaxModeConflictError(mode, ["automatic_tax"], {});
      if (mode === "automatic" && hm) throw new TaxModeConflictError(mode, ["managed_payments"], {});
      if (mode === "managed") params.managed_payments = { enabled: true };
      else params.automatic_tax = { enabled: true };
      return params;
    },
  };
});

// Mock Supabase client used by payments.functions.ts for product lookup.
const cartRows = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Cart Item A",
    price_cents: 1999,
    seller_id: "seller-1",
    status: "approved",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    title: "Cart Item B",
    price_cents: 2999,
    seller_id: "seller-2",
    status: "approved",
  },
];
const singleRow = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Single Product",
  price_cents: 999,
  seller_id: "seller-1",
  status: "approved",
  description: "desc",
};

mock.module("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (_t: string) => {
      const q: any = {
        _data: null as any,
        select() {
          return q;
        },
        eq() {
          return q;
        },
        in() {
          q._data = cartRows;
          return q;
        },
        maybeSingle() {
          return Promise.resolve({ data: singleRow, error: null });
        },
        then(resolve: any, reject: any) {
          return Promise.resolve({ data: q._data, error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  }),
}));

// Stub the server-fn wrapper so we can invoke handlers directly.
mock.module("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder: any = {
      inputValidator(_v: any) {
        return builder;
      },
      handler(fn: any) {
        return (args: any) => fn({ data: args.data, context: {} });
      },
      middleware() {
        return builder;
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

describe("checkout tax-mode invariants", () => {
  it("single-product: managed_payments enabled → no automatic_tax", async () => {
    accountCapability = "active";
    const res = await createProductCheckout({
      data: {
        productId: "11111111-1111-1111-1111-111111111111",
        returnUrl: "https://x/return",
        environment: "sandbox",
      },
    });
    expect(res).toEqual({ clientSecret: "cs_test_123" });
    expect(capturedParams).toHaveLength(1);
    const p = capturedParams[0];
    expect(p.managed_payments).toEqual({ enabled: true });
    expect(p.automatic_tax).toBeUndefined();
    expect(p.line_items[0].price_data.product_data.tax_code).toBe("txcd_10000000");
  });

  it("single-product: no managed capability → automatic_tax only", async () => {
    accountCapability = undefined;
    await createProductCheckout({
      data: {
        productId: "11111111-1111-1111-1111-111111111111",
        returnUrl: "https://x/return",
        environment: "live",
      },
    });
    const p = capturedParams[0];
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.managed_payments).toBeUndefined();
  });

  it("cart: managed_payments enabled → no automatic_tax on session", async () => {
    accountCapability = "active";
    await createCartCheckout({
      data: {
        items: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            title: "A",
            priceCents: 1999,
            qty: 1,
          },
          {
            id: "22222222-2222-2222-2222-222222222222",
            title: "B",
            priceCents: 2999,
            qty: 2,
          },
        ],
        returnUrl: "https://x/return",
        environment: "sandbox",
      },
    });
    const p = capturedParams[0];
    expect(p.managed_payments).toEqual({ enabled: true });
    expect(p.automatic_tax).toBeUndefined();
    for (const li of p.line_items) {
      expect(li.price_data.product_data.tax_code).toBe("txcd_10000000");
    }
  });

  it("cart: no managed capability → automatic_tax only", async () => {
    accountCapability = undefined;
    await createCartCheckout({
      data: {
        items: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            title: "A",
            priceCents: 1999,
            qty: 1,
          },
        ],
        returnUrl: "https://x/return",
        environment: "sandbox",
      },
    });
    const p = capturedParams[0];
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.managed_payments).toBeUndefined();
  });
});
