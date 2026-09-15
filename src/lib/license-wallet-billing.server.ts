/**
 * License Wallet recurring billing — webhook entitlement sync (server only).
 *
 * Called from the existing signed Stripe webhook route. Uses the service role
 * (webhooks have no user session) and resolves the granted plan ONLY from the
 * subscription's price lookup key via the server-side allowlist — Stripe
 * object fields beat webhook metadata, which is used solely to locate the user
 * when the Customer has no `metadata.userId`.
 *
 * Idempotent: every event id is recorded in `license_wallet_billing_events`
 * before entitlement is written; a duplicate delivery is a no-op.
 */
import type Stripe from "stripe";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import {
  entitlementForSubscription,
  planForPriceLookup,
  type PaidWalletPlan,
} from "@/lib/license-wallet-billing";

/** True when this event id has not been processed before (claims it). */
export async function claimBillingEvent(
  eventId: string,
  eventType: string,
  env: StripeEnv,
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as any)
    .from("license_wallet_billing_events")
    .insert({ event_id: eventId, event_type: eventType, environment: env });
  if (error) {
    // Unique violation → already handled.
    return false;
  }
  return true;
}

async function resolveUserId(
  stripe: Stripe,
  subscription: any,
): Promise<string | null> {
  const fromSub = subscription?.metadata?.userId;
  if (typeof fromSub === "string" && fromSub) return fromSub;
  const customerId =
    typeof subscription?.customer === "string"
      ? subscription.customer
      : subscription?.customer?.id;
  if (!customerId) return null;
  try {
    const customer = (await stripe.customers.retrieve(customerId)) as any;
    const id = customer?.metadata?.userId;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

function priceLookupFromSubscription(subscription: any): string | null {
  const item = subscription?.items?.data?.[0];
  const key =
    item?.price?.lookup_key ?? item?.price?.metadata?.lovable_external_id ?? null;
  return typeof key === "string" && key ? key : null;
}

/**
 * Apply a Stripe subscription object to the wallet entitlement row.
 * `forceCanceled` is used for `customer.subscription.deleted`.
 */
export async function syncWalletSubscription(
  subscription: any,
  env: StripeEnv,
  opts: { forceCanceled?: boolean } = {},
): Promise<void> {
  const stripe = createStripeClient(env);
  const userId = await resolveUserId(stripe, subscription);
  if (!userId) {
    console.error("[wallet-billing] no userId for subscription", subscription?.id);
    return;
  }

  const lookupKey = priceLookupFromSubscription(subscription);
  const plan: PaidWalletPlan | null = planForPriceLookup(lookupKey);
  if (!plan) {
    // Not a wallet subscription — ignore (marketplace/other products).
    return;
  }

  const status = opts.forceCanceled ? "canceled" : String(subscription?.status ?? "");
  const sync = entitlementForSubscription(status, plan);

  const item = subscription?.items?.data?.[0];
  const periodEndUnix = item?.current_period_end ?? subscription?.current_period_end;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Environment isolation: a sandbox/test event must never rewrite a LIVE
  // entitlement (both environments share one row per user). Live events may
  // take over a sandbox row — production billing is authoritative.
  const { data: currentRow } = await (supabaseAdmin as any)
    .from("license_wallet_entitlements")
    .select("environment")
    .eq("user_id", userId)
    .maybeSingle();
  if (env === "sandbox" && currentRow?.environment === "live") {
    console.warn("[wallet-billing] ignoring sandbox event for live entitlement", {
      subscription: subscription?.id,
    });
    return;
  }

  await (supabaseAdmin as any).from("license_wallet_entitlements").upsert(

    {
      user_id: userId,
      plan: sync.plan,
      status: sync.status,
      stripe_customer_id:
        typeof subscription?.customer === "string"
          ? subscription.customer
          : subscription?.customer?.id ?? null,
      stripe_subscription_id: subscription?.id ?? null,
      price_lookup_key: lookupKey,
      current_period_end: periodEndUnix
        ? new Date(periodEndUnix * 1000).toISOString()
        : null,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

/** `checkout.session.completed` for a wallet subscription session. */
export async function syncWalletCheckoutSession(
  session: any,
  env: StripeEnv,
): Promise<boolean> {
  if (session?.mode !== "subscription") return false;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!subscriptionId) return false;
  const stripe = createStripeClient(env);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (!planForPriceLookup(priceLookupFromSubscription(subscription))) return false;
  await syncWalletSubscription(subscription, env);
  return true;
}

/** `invoice.payment_failed` — record dunning without premature downgrade. */
export async function syncWalletInvoiceFailure(
  invoice: any,
  env: StripeEnv,
): Promise<void> {
  const subscriptionId =
    typeof invoice?.subscription === "string"
      ? invoice.subscription
      : invoice?.subscription?.id ?? invoice?.parent?.subscription_details?.subscription;
  if (!subscriptionId) return;
  const stripe = createStripeClient(env);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncWalletSubscription(subscription, env);
}