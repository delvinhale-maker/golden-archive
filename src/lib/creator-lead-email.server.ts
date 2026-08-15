import * as React from "react";
import { render } from "react-email";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "AurumVault";
const SENDER_DOMAIN = "notify.www.aurumvault.store";
const FROM_DOMAIN = "www.aurumvault.store";
const SITE_URL = "https://www.aurumvault.store";
const TEMPLATE_NAME = "creator-starter-kit";

function redact(email: string): string {
  const [l, d] = email.split("@");
  return l && d ? `${l[0]}***@${d}` : "***";
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Returns the recipient's stable one-click unsubscribe token, creating one on
 * first send. Best-effort: a failure just means this send has no footer link.
 */
async function getOrCreateUnsubscribeToken(
  supabase: any,
  email: string,
): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", email)
      .maybeSingle();
    if (existing?.token) return existing.token as string;

    const token = generateToken();
    await supabase
      .from("email_unsubscribe_tokens")
      .upsert({ token, email }, { onConflict: "email", ignoreDuplicates: true });

    const { data: stored } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", email)
      .maybeSingle();
    return (stored?.token as string) ?? null;
  } catch (e) {
    console.error("Unsubscribe token lookup failed", { email: redact(email) });
    return null;
  }
}

export type StarterKitSendResult =
  | { sent: true }
  | { sent: false; reason: "opted_out" | "config" | "template" | "enqueue_failed" | "error" };

/**
 * True when the address must never receive this email again: it is on the
 * suppression list (bounce/complaint/unsubscribe) or its one-click
 * unsubscribe token has been used.
 */
async function isOptedOut(supabase: any, email: string): Promise<boolean> {
  const { data: suppressed, error: supErr } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (supErr) {
    // Fail closed: if we can't confirm consent, don't send.
    console.error("Suppression check failed", { email: redact(email) });
    return true;
  }
  if (suppressed) return true;

  const { data: token, error: tokErr } = await supabase
    .from("email_unsubscribe_tokens")
    .select("used_at")
    .eq("email", email)
    .maybeSingle();
  if (tokErr) {
    console.error("Unsubscribe state check failed", { email: redact(email) });
    return true;
  }
  return Boolean(token?.used_at);
}

/**
 * Renders and queues the Seller Starter Kit confirmation email.
 * Best-effort: never throws — lead capture must succeed even if email fails.
 * Skips any address that has unsubscribed or been suppressed.
 */
export async function sendCreatorStarterKitEmail(
  email: string,
  productType: string,
): Promise<StarterKitSendResult> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error("Starter kit email skipped: missing server configuration");
      return { sent: false, reason: "config" };
    }
    const tpl = TEMPLATES[TEMPLATE_NAME];
    if (!tpl) {
      console.error("Starter kit email skipped: template missing");
      return { sent: false, reason: "template" };
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    if (await isOptedOut(supabase, email)) {
      console.warn("Starter kit email skipped: recipient opted out", { email: redact(email) });
      return { sent: false, reason: "opted_out" };
    }


    const props = { siteUrl: SITE_URL, productType };
    const element = React.createElement(tpl.component, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = typeof tpl.subject === "function" ? tpl.subject(props) : tpl.subject;
    const messageId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: TEMPLATE_NAME,
      recipient_email: email,
      status: "pending",
    });

    // One-click unsubscribe token: lets the mail platform attach the compliant
    // List-Unsubscribe header + footer link pointing at our branded page.
    const unsubscribeToken = await getOrCreateUnsubscribeToken(supabase, email);

    const { error } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: TEMPLATE_NAME,
        idempotency_key: `creator-starter-kit-${email}-${productType}`,
        queued_at: nowIso,
        ...(unsubscribeToken ? { unsubscribe_token: unsubscribeToken } : {}),
      },
    });

    if (error) {
      console.error("Starter kit email enqueue failed", { error, email: redact(email) });
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: TEMPLATE_NAME,
        recipient_email: email,
        status: "failed",
        error_message: "enqueue failed",
      });
      return { sent: false, reason: "enqueue_failed" };
    }

    return { sent: true };
  } catch (e) {
    console.error("Starter kit email failed", e);
    return { sent: false, reason: "error" };
  }
}

const CONFIRM_TEMPLATE_NAME = "creator-signup-confirmation";

export type SignupConfirmationSendResult =
  | { sent: true }
  | { sent: false; reason: "opted_out" | "config" | "template" | "enqueue_failed" | "error" };

/**
 * Renders and queues a dedicated signup confirmation email.
 * Best-effort: never throws — lead capture must succeed even if email fails.
 * Skips any address that has unsubscribed or been suppressed.
 */
export async function sendCreatorSignupConfirmation(
  email: string,
  productType: string,
): Promise<SignupConfirmationSendResult> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error("Signup confirmation email skipped: missing server configuration");
      return { sent: false, reason: "config" };
    }
    const tpl = TEMPLATES[CONFIRM_TEMPLATE_NAME];
    if (!tpl) {
      console.error("Signup confirmation email skipped: template missing");
      return { sent: false, reason: "template" };
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    if (await isOptedOut(supabase, email)) {
      console.warn("Signup confirmation email skipped: recipient opted out", { email: redact(email) });
      return { sent: false, reason: "opted_out" };
    }

    const props = { siteUrl: SITE_URL, productType, email: redact(email) };
    const element = React.createElement(tpl.component, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = typeof tpl.subject === "function" ? tpl.subject(props) : tpl.subject;
    const messageId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: CONFIRM_TEMPLATE_NAME,
      recipient_email: email,
      status: "pending",
    });

    const unsubscribeToken = await getOrCreateUnsubscribeToken(supabase, email);

    const { error } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: CONFIRM_TEMPLATE_NAME,
        idempotency_key: `creator-signup-confirmation-${email}-${productType}`,
        queued_at: nowIso,
        ...(unsubscribeToken ? { unsubscribe_token: unsubscribeToken } : {}),
      },
    });

    if (error) {
      console.error("Signup confirmation email enqueue failed", { error, email: redact(email) });
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: CONFIRM_TEMPLATE_NAME,
        recipient_email: email,
        status: "failed",
        error_message: "enqueue failed",
      });
      return { sent: false, reason: "enqueue_failed" };
    }

    return { sent: true };
  } catch (e) {
    console.error("Signup confirmation email failed", e);
    return { sent: false, reason: "error" };
  }
}

/** Where new-creator-signup notifications go. */
const ADMIN_ALERT_EMAIL = "delvin.hale@gmail.com";
const ADMIN_TEMPLATE_NAME = "creator-lead-admin-alert";

/**
 * Notifies the AurumVault team that a new creator signed up.
 * Best-effort: never throws — lead capture must succeed even if this fails.
 */
export async function sendCreatorLeadAdminAlert(lead: {
  email: string;
  productType: string;
  followerCount?: number;
  ctaSource?: string;
}): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return;
    const tpl = TEMPLATES[ADMIN_TEMPLATE_NAME];
    if (!tpl) return;

    const supabase = createClient(supabaseUrl, serviceKey);
    const nowIso = new Date().toISOString();
    const props = {
      leadEmail: lead.email,
      productType: lead.productType,
      followerCount: lead.followerCount,
      ctaSource: lead.ctaSource,
      signedUpAt: nowIso,
    };
    const element = React.createElement(tpl.component, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = typeof tpl.subject === "function" ? tpl.subject(props) : tpl.subject;
    const messageId = crypto.randomUUID();

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: ADMIN_TEMPLATE_NAME,
      recipient_email: ADMIN_ALERT_EMAIL,
      status: "pending",
    });

    const unsubscribeToken = await getOrCreateUnsubscribeToken(supabase, ADMIN_ALERT_EMAIL);

    const { error } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: ADMIN_ALERT_EMAIL,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: ADMIN_TEMPLATE_NAME,
        idempotency_key: `creator-lead-alert-${messageId}`,
        queued_at: nowIso,
        ...(unsubscribeToken ? { unsubscribe_token: unsubscribeToken } : {}),
      },
    });

    if (error) {
      console.error("Creator lead admin alert enqueue failed", { error });
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: ADMIN_TEMPLATE_NAME,
        recipient_email: ADMIN_ALERT_EMAIL,
        status: "failed",
        error_message: "enqueue failed",
      });
    }
  } catch (e) {
    console.error("Creator lead admin alert failed", e);
  }
}
