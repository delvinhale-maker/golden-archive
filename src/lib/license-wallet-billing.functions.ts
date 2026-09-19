/**
 * License Wallet recurring billing — authenticated server functions.
 *
 * Checkout and billing-portal entry points. Both derive the acting user from
 * `requireSupabaseAuth` (never client input) and resolve Stripe prices through
 * the server-side allowlist in `license-wallet-billing.ts`, so the browser can
 * only ever name a *plan*, never a Stripe price or customer id.
 *
 * Fails closed: if a plan has no configured price lookup key, or the price
 * cannot be resolved in Stripe, checkout is refused.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
  extractStripeIds,
} from "@/lib/stripe.server";
import {
  isPaidWalletPlan,
  priceLookupForPlan,
  type PaidWalletPlan,
} from "@/lib/license-wallet-billing";

type CheckoutResult = { clientSecret: string } | { error: string };
type PortalResult = { url: string } | { error: string };

function assertEnv(env: unknown): StripeEnv {
  if (env !== "sandbox" && env !== "live") throw new Error("Invalid environment");
  return env;
}

/** Search-by-metadata first, then email, then create. Never trusts client ids. */
async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  opts: { userId: string; email?: string | null },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(opts.userId)) throw new Error("Invalid user");
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${opts.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;

  if (opts.email) {
    const existing = await stripe.customers.list({ email: opts.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (customer.metadata?.userId !== opts.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: opts.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(opts.email ? { email: opts.email } : {}),
    metadata: { userId: opts.userId },
  });
  return created.id;
}

async function readEntitlementRow(supabase: any, userId: string) {
  const { data } = await supabase
    .from("license_wallet_entitlements" as never)
    .select("plan,status,stripe_customer_id,stripe_subscription_id" as never)
    .eq("user_id" as never, userId)
    .maybeSingle();
  return (data ?? null) as {
    plan: string;
    status: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  } | null;
}

/**
 * Start a subscription checkout for one of the three paid Wallet plans.
 * Returns an embedded-checkout client secret (same convention as the
 * marketplace one-time flows, which are left untouched).
 */
export const createWalletPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { plan: string; returnUrl: string; environment: StripeEnv }) => {
    assertEnv(data.environment);
    if (!isPaidWalletPlan(data.plan)) throw new Error("Unknown plan");
    if (typeof data.returnUrl !== "string" || !data.returnUrl.startsWith("http")) {
      throw new Error("Invalid return URL");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { supabase, userId } = context as any;
    const email = (context.claims as { email?: string })?.email ?? null;
    const plan = data.plan as PaidWalletPlan;

    const lookupKey = priceLookupForPlan(plan);
    if (!lookupKey) return { error: "That plan isn't available for purchase yet." };

    try {
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true });
      const price = prices.data[0];
      if (!price || price.type !== "recurring") {
        return { error: "That plan isn't available for purchase yet." };
      }

      const existing = await readEntitlementRow(supabase, userId);
      if (existing?.stripe_subscription_id && existing.status === "active") {
        return {
          error: "You already have an active Wallet plan. Use Manage billing to change it.",
        };
      }

      const customerId =
        existing?.stripe_customer_id ??
        (await resolveOrCreateCustomer(stripe, { userId, email }));

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: {
          userId,
          wallet_plan: plan,
          price_lookup_key: lookupKey,
          environment: data.environment,
        },
        subscription_data: {
          metadata: { userId, wallet_plan: plan, price_lookup_key: lookupKey },
        },
      } as any);

      // Persist the customer id so the billing portal never needs client input.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any)
        .from("license_wallet_entitlements")
        .upsert(
          {
            user_id: userId,
            plan: existing?.plan ?? "FREE",
            status: existing?.status ?? "canceled",
            stripe_customer_id: customerId,
            environment: data.environment,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("[wallet-billing] checkout failed", {
        stripe: extractStripeIds(error),
      });
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Stripe Billing Portal for the signed-in user's stored customer only. */
export const createWalletBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => {
    assertEnv(data.environment);
    return data;
  })
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { supabase, userId } = context as any;
    const existing = await readEntitlementRow(supabase, userId);
    if (!existing?.stripe_customer_id) {
      return { error: "No billing account found for your wallet yet." };
    }
    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: existing.stripe_customer_id,
        ...(data.returnUrl ? { return_url: data.returnUrl } : {}),
      });
      return { url: portal.url };
    } catch (error) {
      console.error("[wallet-billing] portal failed", { stripe: extractStripeIds(error) });
      return { error: "Billing management is unavailable right now." };
    }
  });