import * as React from "react";
import { render } from "react-email";
import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { TEMPLATES } from "@/lib/email-templates/registry";

const PUBLIC_BASE_URL = "https://www.aurumvault.store";
const SITE_NAME = "AurumVault";
const SENDER_DOMAIN = "notify.www.aurumvault.store";
const FROM_DOMAIN = "www.aurumvault.store";
const PLATFORM_FEE_PCT = 9;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Idempotency: skip if order already exists for this session.
  const existing = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (existing.data) {
    console.log("Order already processed:", session.id);
    return;
  }

  const productId: string | undefined = session.metadata?.product_id;
  const sellerId: string | undefined = session.metadata?.seller_id;
  const buyerEmail: string =
    session.customer_details?.email ?? session.customer_email ?? "";

  if (!productId || !sellerId || !buyerEmail) {
    console.error("Missing required metadata on session", session.id);
    return;
  }

  // Look up product (need title)
  const { data: product, error: prodErr } = await supabaseAdmin
    .from("marketplace_products")
    .select("id,title,price_cents")
    .eq("id", productId)
    .maybeSingle();
  if (prodErr || !product) {
    console.error("Product not found for webhook", productId);
    return;
  }

  const unitAmount = product.price_cents;
  const platformFee = Math.round((unitAmount * PLATFORM_FEE_PCT) / 100);
  const sellerAmount = unitAmount - platformFee;

  // Insert order
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      buyer_email: buyerEmail,
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent ?? null,
      amount_cents: session.amount_total ?? unitAmount,
      currency: session.currency ?? "usd",
      status: "paid",
      environment: env,
    })
    .select("id")
    .single();
  if (orderErr || !order) {
    console.error("Failed to insert order", orderErr);
    return;
  }

  // Insert order_item
  const { data: item, error: itemErr } = await supabaseAdmin
    .from("order_items")
    .insert({
      order_id: order.id,
      product_id: product.id,
      seller_id: sellerId,
      product_title: product.title,
      unit_amount_cents: unitAmount,
      platform_fee_cents: platformFee,
      seller_amount_cents: sellerAmount,
    })
    .select("id")
    .single();
  if (itemErr || !item) {
    console.error("Failed to insert order item", itemErr);
    return;
  }

  // Generate download token
  const token = generateToken();
  await supabaseAdmin.from("order_downloads").insert({
    order_item_id: item.id,
    token,
  });

  // Update seller balance ledger
  const { data: bal } = await supabaseAdmin
    .from("seller_balances")
    .select("pending_cents")
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (bal) {
    await supabaseAdmin
      .from("seller_balances")
      .update({ pending_cents: Number(bal.pending_cents) + sellerAmount })
      .eq("seller_id", sellerId);
  } else {
    await supabaseAdmin
      .from("seller_balances")
      .insert({ seller_id: sellerId, pending_cents: sellerAmount });
  }

  // Enqueue delivery email
  await enqueueDeliveryEmail({
    to: buyerEmail,
    items: [{ title: product.title, downloadUrl: `${PUBLIC_BASE_URL}/download/${token}` }],
    totalFormatted: `$${((session.amount_total ?? unitAmount) / 100).toFixed(2)}`,
    orderId: order.id,
  });
}

async function enqueueDeliveryEmail(args: {
  to: string;
  items: { title: string; downloadUrl: string }[];
  totalFormatted: string;
  orderId: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const template = TEMPLATES["order-delivery"];
  if (!template) {
    console.error("order-delivery template missing");
    return;
  }
  const normalized = args.to.toLowerCase();

  // suppression check
  const { data: suppressed } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (suppressed) {
    console.log("Recipient suppressed, skipping delivery email");
    return;
  }

  // unsubscribe token
  let unsubscribeToken: string;
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token,used_at")
    .eq("email", normalized)
    .maybeSingle();
  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token;
  } else {
    unsubscribeToken = generateToken();
    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .upsert(
        { token: unsubscribeToken, email: normalized },
        { onConflict: "email", ignoreDuplicates: true },
      );
    const { data: stored } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalized)
      .maybeSingle();
    if (stored) unsubscribeToken = stored.token;
  }

  const element = React.createElement(template.component, args);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(args) : template.subject;
  const messageId = crypto.randomUUID();

  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: "order-delivery",
    recipient_email: args.to,
    status: "pending",
  });

  await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: args.to,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: "order-delivery",
      idempotency_key: `order-${args.orderId}`,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });
}

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook missing/invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          if (event.type === "checkout.session.completed") {
            await handleCheckoutCompleted(event.data.object, env);
          } else {
            console.log("Unhandled event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
