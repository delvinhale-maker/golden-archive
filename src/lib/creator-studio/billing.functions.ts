import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  requireCreatorStudioEnabled,
  requireCreatorStudioPaidPlansEnabled,
} from "./feature-flags.middleware";
import {
  type StripeEnv,
  createStripeClient,
  detectTaxMode,
  applyTaxMode,
  assertTaxModeInvariant,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

/**
 * Creator Studio billing. Reuses the SAME Stripe client, tax-mode helpers,
 * and env split (sandbox/live) as every other checkout in
 * src/lib/payments.functions.ts -- this is intentionally not a parallel
 * Stripe integration. There is no pre-existing subscription/recurring
 * billing anywhere in this codebase (verified: every other checkout uses
 * mode:"payment" only), so the subscription checkout below is the first use
 * of mode:"subscription" in the repo -- see docs/creator-studio/README.md
 * for why that was judged the right, minimal extension rather than a
 * bespoke plan/entitlement system.
 *
 * Price ids are never hardcoded -- they come from environment variables so
 * the actual Stripe Price objects can be created/rotated per environment
 * without a code change.
 */

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

function getExtraCreditPriceId(env: StripeEnv): string {
  return env === "sandbox"
    ? getEnv("CREATOR_STUDIO_PRICE_EXTRA_CREDIT_SANDBOX")
    : getEnv("CREATOR_STUDIO_PRICE_EXTRA_CREDIT_LIVE");
}

function getSubscriptionPriceId(plan: "CREATOR_PRO" | "CREATOR_BUSINESS", env: StripeEnv): string {
  const varName =
    plan === "CREATOR_PRO"
      ? env === "sandbox"
        ? "CREATOR_STUDIO_PRICE_PRO_SANDBOX"
        : "CREATOR_STUDIO_PRICE_PRO_LIVE"
      : env === "sandbox"
        ? "CREATOR_STUDIO_PRICE_BUSINESS_SANDBOX"
        : "CREATOR_STUDIO_PRICE_BUSINESS_LIVE";
  return getEnv(varName);
}

type CheckoutResult = { clientSecret: string } | { error: string };

const checkoutInput = z.object({
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
});

async function resolveCustomerRef(
  supabase: any,
  userId: string,
  buyerEmail: string | undefined,
): Promise<{ customer?: string; customer_email?: string }> {
  const { data: row } = await supabase
    .from("creator_studio_entitlements" as any)
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (row?.stripe_customer_id) return { customer: row.stripe_customer_id };
  return buyerEmail ? { customer_email: buyerEmail } : {};
}

export const createExtraCreditCheckoutFn = createServerFn({ method: "POST" })
  .middleware([
    requireCreatorStudioEnabled,
    requireCreatorStudioPaidPlansEnabled,
    requireSupabaseAuth,
  ])
  .inputValidator((data: unknown) => checkoutInput.parse(data))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const buyerEmail = (context.claims as { email?: string })?.email;
      const stripe = createStripeClient(data.environment);
      const taxMode = await detectTaxMode(stripe, data.environment);
      const customerRef = await resolveCustomerRef(context.supabase, context.userId, buyerEmail);

      const sessionParams = applyTaxMode(
        {
          mode: "payment" as const,
          ui_mode: "embedded_page" as const,
          return_url: data.returnUrl,
          line_items: [{ price: getExtraCreditPriceId(data.environment), quantity: 1 }],
          ...customerRef,
          payment_intent_data: { description: "AurumVault Creator Studio — 1 extra video" },
          metadata: {
            creator_studio_kind: "EXTRA_CREDIT",
            creator_studio_user_id: context.userId,
            environment: data.environment,
          },
        },
        taxMode,
      );
      assertTaxModeInvariant(sessionParams, taxMode);
      const session = await stripe.checkout.sessions.create(sessionParams as any);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("[creator-studio] createExtraCreditCheckoutFn failed", {
        message: (error as Error)?.message,
      });
      return { error: getStripeErrorMessage(error) };
    }
  });

const subscriptionCheckoutInput = checkoutInput.extend({
  plan: z.enum(["CREATOR_PRO", "CREATOR_BUSINESS"]),
});

export const createSubscriptionCheckoutFn = createServerFn({ method: "POST" })
  .middleware([
    requireCreatorStudioEnabled,
    requireCreatorStudioPaidPlansEnabled,
    requireSupabaseAuth,
  ])
  .inputValidator((data: unknown) => subscriptionCheckoutInput.parse(data))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const buyerEmail = (context.claims as { email?: string })?.email;
      const stripe = createStripeClient(data.environment);
      const taxMode = await detectTaxMode(stripe, data.environment);
      const customerRef = await resolveCustomerRef(context.supabase, context.userId, buyerEmail);

      const sessionParams = applyTaxMode(
        {
          mode: "subscription" as const,
          ui_mode: "embedded_page" as const,
          return_url: data.returnUrl,
          line_items: [{ price: getSubscriptionPriceId(data.plan, data.environment), quantity: 1 }],
          ...customerRef,
          metadata: {
            creator_studio_kind:
              data.plan === "CREATOR_PRO" ? "SUBSCRIPTION_PRO" : "SUBSCRIPTION_BUSINESS",
            creator_studio_user_id: context.userId,
            environment: data.environment,
          },
        },
        taxMode,
      );
      assertTaxModeInvariant(sessionParams, taxMode);
      const session = await stripe.checkout.sessions.create(sessionParams as any);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("[creator-studio] createSubscriptionCheckoutFn failed", {
        message: (error as Error)?.message,
      });
      return { error: getStripeErrorMessage(error) };
    }
  });
