import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  applyTaxMode,
  assertTaxModeInvariant,
  createStripeClient,
  detectTaxMode,
  type StripeEnv,
} from "@/lib/stripe.server";

export type CreatorStudioPlan = "FREE" | "CREATOR_PRO" | "CREATOR_BUSINESS";
export type CreatorStudioBillingStatus = "FREE" | "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export type CreatorStudioEntitlementSummary = {
  plan: CreatorStudioPlan;
  billingStatus: CreatorStudioBillingStatus;
  includedVideos: number;
  includedUsed: number;
  includedRemaining: number;
  freePreviewRemaining: number;
  extraVideosRemaining: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

const planCheckoutSchema = z.object({
  plan: z.enum(["CREATOR_PRO", "CREATOR_BUSINESS"]),
}).strict();
const extraCheckoutSchema = z.object({ quantity: z.number().int().min(1).max(20).default(1) }).strict();

const EXPECTED_PRICES = {
  CREATOR_PRO: { amount: 1900, recurring: true },
  CREATOR_BUSINESS: { amount: 4900, recurring: true },
  EXTRA_VIDEO: { amount: 300, recurring: false },
} as const;

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function configuredBillingEnv(): StripeEnv {
  const env = (process.env.CREATOR_STUDIO_BILLING_ENV ?? "sandbox").toLowerCase();
  if (env !== "sandbox" && env !== "live") throw new Error("Creator Studio billing environment is invalid.");
  if (env === "live" && process.env.CREATOR_STUDIO_BILLING_LIVE_ENABLED !== "true") {
    throw new Error("Creator Studio live billing is disabled.");
  }
  return env;
}

function assertLiveAllowed(env: StripeEnv) {
  if (env === "live" && process.env.CREATOR_STUDIO_BILLING_LIVE_ENABLED !== "true") {
    throw new Error("Creator Studio live billing is disabled.");
  }
}

function publicBaseUrl() {
  const raw = process.env.CREATOR_STUDIO_PUBLIC_BASE_URL;
  if (!raw) throw new Error("Creator Studio public URL is not configured.");
  const parsed = new URL(raw);
  const local = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !local) throw new Error("Creator Studio public URL is invalid.");
  return parsed.origin;
}

function priceId(env: StripeEnv, kind: keyof typeof EXPECTED_PRICES) {
  const suffix = env === "sandbox" ? "SANDBOX" : "LIVE";
  const key = `CREATOR_STUDIO_${kind}_PRICE_ID_${suffix}`;
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

function planFromPrice(env: StripeEnv, id: string | null | undefined): Exclude<CreatorStudioPlan, "FREE"> | null {
  if (!id) return null;
  const pro = process.env[`CREATOR_STUDIO_CREATOR_PRO_PRICE_ID_${env === "sandbox" ? "SANDBOX" : "LIVE"}`];
  const business = process.env[`CREATOR_STUDIO_CREATOR_BUSINESS_PRICE_ID_${env === "sandbox" ? "SANDBOX" : "LIVE"}`];
  if (pro && id === pro) return "CREATOR_PRO";
  if (business && id === business) return "CREATOR_BUSINESS";
  return null;
}

function configuredPlanPriceId(env: StripeEnv, plan: Exclude<CreatorStudioPlan, "FREE">) {
  return plan === "CREATOR_PRO" ? priceId(env, "CREATOR_PRO") : priceId(env, "CREATOR_BUSINESS");
}

async function verifyConfiguredPrice(
  stripe: ReturnType<typeof createStripeClient>,
  env: StripeEnv,
  kind: keyof typeof EXPECTED_PRICES,
) {
  const id = priceId(env, kind);
  const price = await stripe.prices.retrieve(id);
  const expected = EXPECTED_PRICES[kind];
  if (!price.active || price.currency !== "usd" || price.unit_amount !== expected.amount) {
    throw new Error(`Creator Studio ${kind} Stripe price is misconfigured.`);
  }
  if (expected.recurring) {
    if (!price.recurring || price.recurring.interval !== "month" || price.recurring.interval_count !== 1) {
      throw new Error(`Creator Studio ${kind} Stripe price must recur monthly.`);
    }
  } else if (price.recurring) {
    throw new Error("Creator Studio extra-video Stripe price must be one-time.");
  }
  return id;
}

async function existingCustomerId(ownerUserId: string, env: StripeEnv) {
  const admin = await adminClient();
  const { data } = await admin
    .from("creator_studio_billing_state")
    .select("stripe_customer_id,stripe_environment")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  return data?.stripe_environment === env && data?.stripe_customer_id ? String(data.stripe_customer_id) : null;
}

function claimEmail(claims: any): string | null {
  const email = typeof claims?.email === "string" ? claims.email.trim().toLowerCase() : "";
  return email && email.includes("@") ? email : null;
}

async function createCheckout(
  ownerUserId: string,
  claims: any,
  kind: "CREATOR_PRO" | "CREATOR_BUSINESS" | "EXTRA_VIDEO",
  quantity = 1,
) {
  const env = configuredBillingEnv();
  const stripe = createStripeClient(env);
  const id = await verifyConfiguredPrice(stripe, env, kind);
  const customer = await existingCustomerId(ownerUserId, env);
  const email = claimEmail(claims);
  if (!customer && !email) throw new Error("A verified account email is required for billing.");
  const base = publicBaseUrl();
  const metadata: Record<string, string> = {
    aurumvault_flow: "creator_studio",
    owner_user_id: ownerUserId,
    purchase_type: kind === "EXTRA_VIDEO" ? "extra_video" : "subscription",
  };
  if (kind !== "EXTRA_VIDEO") metadata.plan_key = kind;

  const params: any = {
    mode: kind === "EXTRA_VIDEO" ? "payment" : "subscription",
    line_items: [{ price: id, quantity }],
    success_url: `${base}/creator-studio?billing=success`,
    cancel_url: `${base}/creator-studio?billing=cancelled`,
    client_reference_id: ownerUserId,
    metadata,
    allow_promotion_codes: false,
  };
  if (customer) params.customer = customer;
  else params.customer_email = email;
  if (kind !== "EXTRA_VIDEO") {
    params.subscription_data = { metadata };
  }

  const taxMode = await detectTaxMode(stripe, env);
  applyTaxMode(params, taxMode);
  assertTaxModeInvariant(params, taxMode);
  const session = await stripe.checkout.sessions.create(params);
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return { url: session.url };
}

export const createCreatorStudioPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planCheckoutSchema.parse(input))
  .handler(async ({ data, context }) => createCheckout(context.userId, context.claims, data.plan));

export const createCreatorStudioExtraVideoCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => extraCheckoutSchema.parse(input))
  .handler(async ({ data, context }) => createCheckout(context.userId, context.claims, "EXTRA_VIDEO", data.quantity));

export const getCreatorStudioEntitlementSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudioEntitlementSummary> => {
    const admin = await adminClient();
    const { data: ent } = await admin
      .from("creator_studio_entitlements")
      .select("plan_key,billing_status,current_period_start,current_period_end,cancel_at_period_end")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    const plan = (ent?.plan_key ?? "FREE") as CreatorStudioPlan;
    const status = (ent?.billing_status ?? "FREE") as CreatorStudioBillingStatus;
    const activePaid = status === "ACTIVE" && (plan === "CREATOR_PRO" || plan === "CREATOR_BUSINESS")
      && !!ent?.current_period_start && !!ent?.current_period_end
      && Date.parse(ent.current_period_start) <= Date.now() && Date.parse(ent.current_period_end) > Date.now();
    const includedVideos = activePaid ? (plan === "CREATOR_PRO" ? 10 : 50) : 0;
    let includedUsed = 0;
    if (activePaid) {
      const { count } = await admin.from("creator_studio_usage_reservations").select("id", { count: "exact", head: true })
        .eq("owner_user_id", context.userId).eq("source", "PLAN_INCLUDED")
        .eq("period_start", ent.current_period_start).in("state", ["RESERVED", "CONSUMED"]);
      includedUsed = count ?? 0;
    }
    const { count: previewCount } = await admin.from("creator_studio_usage_reservations")
      .select("id", { count: "exact", head: true }).eq("owner_user_id", context.userId)
      .eq("source", "FREE_PREVIEW").in("state", ["RESERVED", "CONSUMED"]);
    const { data: credits } = await admin.from("creator_studio_extra_video_credits")
      .select("quantity_remaining").eq("owner_user_id", context.userId).gt("quantity_remaining", 0);
    const extraVideosRemaining = (credits ?? []).reduce((sum: number, row: any) => sum + Number(row.quantity_remaining || 0), 0);
    return {
      plan: activePaid ? plan : "FREE",
      billingStatus: activePaid ? status : "FREE",
      includedVideos,
      includedUsed,
      includedRemaining: Math.max(0, includedVideos - includedUsed),
      freePreviewRemaining: (previewCount ?? 0) > 0 ? 0 : 1,
      extraVideosRemaining,
      currentPeriodEnd: activePaid ? ent.current_period_end : null,
      cancelAtPeriodEnd: activePaid ? !!ent.cancel_at_period_end : false,
    };
  });

function epoch(value: unknown): string | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

function subscriptionPeriod(subscription: any) {
  const item = subscription?.items?.data?.[0];
  return {
    start: epoch(subscription?.current_period_start ?? item?.current_period_start),
    end: epoch(subscription?.current_period_end ?? item?.current_period_end),
  };
}

function billingStatus(status: string | null | undefined): Exclude<CreatorStudioBillingStatus, "FREE"> {
  if (status === "active" || status === "trialing") return "ACTIVE";
  if (status === "past_due" || status === "unpaid" || status === "paused") return "PAST_DUE";
  if (status === "canceled") return "CANCELED";
  return "PENDING";
}

function ownerIdFromMetadata(metadata: any): string | null {
  const parsed = z.string().uuid().safeParse(metadata?.owner_user_id);
  return parsed.success ? parsed.data : null;
}

function eventCreatedAt(event: any) {
  return epoch(event?.created) ?? new Date().toISOString();
}

async function applySubscription(event: any, env: StripeEnv, subscription: any, fallbackOwner?: string | null) {
  const item = subscription?.items?.data?.[0];
  const actualPriceId = item?.price?.id ?? null;
  const plan = planFromPrice(env, actualPriceId);
  if (!plan) return false;
  const owner = ownerIdFromMetadata(subscription?.metadata) ?? fallbackOwner ?? null;
  if (!owner) throw new Error("Creator Studio Stripe subscription is missing its owner.");
  const period = subscriptionPeriod(subscription);
  const admin = await adminClient();
  const { error } = await admin.rpc("creator_studio_server_apply_subscription_event", {
    _owner_user_id: owner,
    _stripe_environment: env,
    _stripe_event_id: String(event.id),
    _event_type: String(event.type),
    _event_created: eventCreatedAt(event),
    _stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
    _stripe_subscription_id: String(subscription.id),
    _stripe_price_id: String(actualPriceId),
    _plan_key: plan,
    _billing_status: billingStatus(subscription.status),
    _period_start: period.start,
    _period_end: period.end,
    _cancel_at_period_end: !!subscription.cancel_at_period_end,
  });
  if (error) throw error;
  return true;
}

async function processCreatorStudioCheckout(event: any, env: StripeEnv, session: any) {
  if (session?.metadata?.aurumvault_flow !== "creator_studio") return false;
  assertLiveAllowed(env);
  const owner = ownerIdFromMetadata(session.metadata);
  if (!owner) throw new Error("Creator Studio checkout is missing its owner.");
  const stripe = createStripeClient(env);

  if (session.metadata.purchase_type === "extra_video") {
    if (session.payment_status !== "paid") return true;
    const expectedId = await verifyConfiguredPrice(stripe, env, "EXTRA_VIDEO");
    const lineItems = await stripe.checkout.sessions.listLineItems(String(session.id), { limit: 20 });
    let quantity = 0;
    for (const item of lineItems.data) {
      const id = typeof item.price === "string" ? item.price : item.price?.id;
      if (id !== expectedId) throw new Error("Creator Studio extra-video checkout contained an unexpected Stripe price.");
      quantity += Number(item.quantity ?? 0);
    }
    if (quantity < 1 || quantity > 20) throw new Error("Creator Studio extra-video quantity is invalid.");
    const admin = await adminClient();
    const { error } = await admin.rpc("creator_studio_server_grant_extra_video_event", {
      _owner_user_id: owner,
      _stripe_environment: env,
      _stripe_event_id: String(event.id),
      _event_type: String(event.type),
      _event_created: eventCreatedAt(event),
      _stripe_checkout_session_id: String(session.id),
      _quantity: quantity,
    });
    if (error) throw error;
    return true;
  }

  if (session.metadata.purchase_type === "subscription") {
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!subscriptionId) throw new Error("Creator Studio subscription checkout is missing its subscription.");
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });
    return applySubscription(event, env, subscription, owner);
  }

  throw new Error("Creator Studio checkout type is invalid.");
}

/**
 * Dispatches only Creator Studio Stripe events. Returns false when the event
 * belongs to the existing AurumVault marketplace so its current webhook path
 * can continue unchanged.
 */
export async function handleCreatorStudioStripeEvent(event: any, env: StripeEnv): Promise<boolean> {
  if (!event?.id || !event?.type) return false;
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    return processCreatorStudioCheckout(event, env, event.data?.object);
  }
  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    assertLiveAllowed(env);
    const subscription = event.data?.object;
    const itemPriceId = subscription?.items?.data?.[0]?.price?.id ?? null;
    if (!planFromPrice(env, itemPriceId)) return false;
    return applySubscription(event, env, subscription, ownerIdFromMetadata(subscription?.metadata));
  }
  return false;
}
