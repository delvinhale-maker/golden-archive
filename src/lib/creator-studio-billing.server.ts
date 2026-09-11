import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CreatorStudioPlan } from "./creator-studio-entitlements";

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Creator Studio billing is not configured");
  return new Stripe(key);
}

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Creator Studio service database is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function appUrl() {
  const url = process.env.CREATOR_STUDIO_APP_URL;
  if (!url) throw new Error("Creator Studio application URL is not configured");
  return z.string().url().parse(url).replace(/\/$/, "");
}

function priceIdForPlan(plan: Exclude<CreatorStudioPlan, "FREE">) {
  const priceId = plan === "CREATOR_PRO"
    ? process.env.CREATOR_STUDIO_PRO_PRICE_ID
    : process.env.CREATOR_STUDIO_BUSINESS_PRICE_ID;
  if (!priceId) throw new Error("Creator Studio plan billing is not configured");
  return priceId;
}

function planFromSubscription(subscription: Stripe.Subscription): Exclude<CreatorStudioPlan, "FREE"> | null {
  const metadataPlan = subscription.metadata?.plan;
  if (metadataPlan === "CREATOR_PRO" || metadataPlan === "CREATOR_BUSINESS") return metadataPlan;
  const priceId = subscription.items.data[0]?.price?.id;
  if (priceId && priceId === process.env.CREATOR_STUDIO_PRO_PRICE_ID) return "CREATOR_PRO";
  if (priceId && priceId === process.env.CREATOR_STUDIO_BUSINESS_PRICE_ID) return "CREATOR_BUSINESS";
  return null;
}

function ownerFromSubscription(subscription: Stripe.Subscription) {
  return subscription.metadata?.ownerUserId || null;
}

function customerId(subscription: Stripe.Subscription) {
  return typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0] as Stripe.SubscriptionItem | undefined;
  const start = item?.current_period_start;
  const end = item?.current_period_end;
  if (!start || !end || end <= start) throw new Error("Creator Studio subscription period is unavailable");
  return {
    periodStart: new Date(start * 1000).toISOString(),
    periodEnd: new Date(end * 1000).toISOString(),
  };
}

async function syncCreatorStudioSubscription(subscription: Stripe.Subscription) {
  if (subscription.metadata?.creatorStudioKind !== "PLAN") return false;
  const ownerUserId = ownerFromSubscription(subscription);
  if (!ownerUserId) return false;
  const db = serviceClient();
  const plan = planFromSubscription(subscription);
  const isEntitled = (subscription.status === "active" || subscription.status === "trialing") && plan;

  if (!isEntitled) {
    const { error } = await db.from("creator_studio_entitlements").upsert({
      owner_user_id: ownerUserId,
      plan_key: "FREE",
      included_videos: 1,
      stripe_customer_id: customerId(subscription),
      stripe_subscription_id: subscription.status === "canceled" ? null : subscription.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_user_id" });
    if (error) throw new Error("Couldn't update Creator Studio plan");
    return true;
  }

  const { periodStart, periodEnd } = subscriptionPeriod(subscription);
  const included = plan === "CREATOR_PRO" ? 10 : 50;
  const { error } = await db.from("creator_studio_entitlements").upsert({
    owner_user_id: ownerUserId,
    plan_key: plan,
    included_videos: included,
    stripe_customer_id: customerId(subscription),
    stripe_subscription_id: subscription.id,
    period_start: periodStart,
    period_end: periodEnd,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_user_id" });
  if (error) throw new Error("Couldn't activate Creator Studio plan");
  return true;
}

export async function createCreatorStudioPlanCheckout(ownerUserId: string, plan: Exclude<CreatorStudioPlan, "FREE">) {
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    success_url: `${appUrl()}/creator-studio?billing=success`,
    cancel_url: `${appUrl()}/creator-studio?billing=cancelled`,
    client_reference_id: ownerUserId,
    metadata: { creatorStudioKind: "PLAN", ownerUserId, plan },
    subscription_data: { metadata: { creatorStudioKind: "PLAN", ownerUserId, plan } },
  });
  if (!session.url) throw new Error("Couldn't create Creator Studio checkout");
  return { url: session.url };
}

export async function createCreatorStudioExtraRenderCheckout(ownerUserId: string, quantity: number) {
  const qty = z.number().int().min(1).max(50).parse(quantity);
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: 300,
        product_data: { name: "AurumVault Creator Studio — Extra Video" },
      },
      quantity: qty,
    }],
    success_url: `${appUrl()}/creator-studio?billing=success`,
    cancel_url: `${appUrl()}/creator-studio?billing=cancelled`,
    client_reference_id: ownerUserId,
    metadata: { creatorStudioKind: "EXTRA_VIDEO", ownerUserId, quantity: String(qty) },
  });
  if (!session.url) throw new Error("Couldn't create Creator Studio checkout");
  return { url: session.url };
}

export async function handleCreatorStudioStripeWebhook(rawBody: string, signature: string) {
  const secret = process.env.CREATOR_STUDIO_STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Creator Studio Stripe webhook is not configured");
  const stripe = stripeClient();
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const kind = session.metadata?.creatorStudioKind;
    const ownerUserId = session.metadata?.ownerUserId || session.client_reference_id;
    if (!ownerUserId) return { handled: false };

    if (kind === "EXTRA_VIDEO" && session.payment_status === "paid") {
      const quantity = z.coerce.number().int().min(1).max(50).parse(session.metadata?.quantity);
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : "";
      const db = serviceClient();
      const { error } = await db.rpc("creator_studio_grant_extra_credits", {
        p_owner_user_id: ownerUserId,
        p_checkout_session_id: session.id,
        p_payment_intent_id: paymentIntentId,
        p_quantity: quantity,
        p_amount_paid_cents: session.amount_total ?? 0,
      });
      if (error) throw new Error("Couldn't grant Creator Studio video credit");
      return { handled: true };
    }

    if (kind === "PLAN" && typeof session.subscription === "string") {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      return { handled: await syncCreatorStudioSubscription(subscription) };
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    return { handled: await syncCreatorStudioSubscription(event.data.object) };
  }

  return { handled: false };
}
