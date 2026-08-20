import * as React from "react";
import { render } from "react-email";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "AurumVault";
const SENDER_DOMAIN = "notify.www.aurumvault.store";
const FROM_DOMAIN = "www.aurumvault.store";
const SITE_URL = "https://www.aurumvault.store";

/** Days after confirmation each follow-up step goes out. */
const WELCOME_2_AFTER_DAYS = 3;
const WELCOME_3_AFTER_DAYS = 6;
/** Catch-up window so a missed cron run doesn't skip anyone entirely. */
const CATCH_UP_WINDOW_DAYS = 3;

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

function serverSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey);
}

/**
 * Returns the recipient's stable one-click unsubscribe token, creating one on
 * first send. Best-effort: a failure just means this send has no footer link.
 */
async function getOrCreateUnsubscribeToken(supabase: any, email: string): Promise<string | null> {
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
  } catch {
    console.error("Unsubscribe token lookup failed", { email: redact(email) });
    return null;
  }
}

/**
 * True when the address must never receive marketing email: it is on the
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
    console.error("Suppression check failed", { email: redact(email) });
    return true; // fail closed
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

async function renderAndEnqueue(
  supabase: any,
  templateName: string,
  email: string,
  idempotencyKey: string,
): Promise<boolean> {
  const tpl = TEMPLATES[templateName];
  if (!tpl) {
    console.error("Subscriber sequence email skipped: template missing", { templateName });
    return false;
  }

  const props = { siteUrl: SITE_URL };
  const element = React.createElement(tpl.component, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = typeof tpl.subject === "function" ? tpl.subject(props) : tpl.subject;
  const messageId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
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
      label: templateName,
      idempotency_key: idempotencyKey,
      queued_at: nowIso,
      ...(unsubscribeToken ? { unsubscribe_token: unsubscribeToken } : {}),
    },
  });

  if (error) {
    console.error("Subscriber sequence email enqueue failed", { error, email: redact(email), templateName });
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: email,
      status: "failed",
      error_message: "enqueue failed",
    });
    return false;
  }

  return true;
}

export type WelcomeSendResult =
  | { sent: true }
  | { sent: false; reason: "opted_out" | "config" | "not_confirmed" | "error" };

/**
 * Sends the first welcome email immediately after a subscriber confirms
 * their address. Idempotent per email — safe to call more than once for the
 * same address (e.g. the confirm page re-firing on refresh).
 */
export async function sendSubscriberWelcomeEmail(email: string): Promise<WelcomeSendResult> {
  try {
    const supabase = serverSupabase();
    if (!supabase) {
      console.error("Subscriber welcome email skipped: missing server configuration");
      return { sent: false, reason: "config" };
    }

    const { data: subscriber } = await supabase
      .from("subscribers")
      .select("status")
      .eq("email", email)
      .maybeSingle();
    if (subscriber?.status !== "confirmed") {
      return { sent: false, reason: "not_confirmed" };
    }

    if (await isOptedOut(supabase, email)) {
      console.warn("Subscriber welcome email skipped: recipient opted out", { email: redact(email) });
      return { sent: false, reason: "opted_out" };
    }

    const ok = await renderAndEnqueue(
      supabase,
      "subscriber-welcome-1",
      email,
      `subscriber-welcome-1-${email}`,
    );
    return ok ? { sent: true } : { sent: false, reason: "error" };
  } catch (e) {
    console.error("Subscriber welcome email failed", e);
    return { sent: false, reason: "error" };
  }
}

/**
 * Cron entry point. Sends step 2 (~day 3) and step 3 (~day 6) of the welcome
 * sequence to confirmed subscribers who are due and haven't received that
 * step yet. Meant to be called at most a few times a day; each step is
 * looked up in a bounded window so a missed run doesn't skip anyone, and
 * `email_send_log` is used to avoid re-sending a step already queued.
 */
export async function sendDueSubscriberSequenceEmails(): Promise<{
  step2Sent: number;
  step3Sent: number;
}> {
  const supabase = serverSupabase();
  if (!supabase) {
    console.error("Subscriber sequence cron skipped: missing server configuration");
    return { step2Sent: 0, step3Sent: 0 };
  }

  const steps = [
    { templateName: "subscriber-welcome-2", afterDays: WELCOME_2_AFTER_DAYS },
    { templateName: "subscriber-welcome-3", afterDays: WELCOME_3_AFTER_DAYS },
  ] as const;

  const sentCounts: Record<string, number> = {};

  for (const step of steps) {
    sentCounts[step.templateName] = 0;
    const now = Date.now();
    const windowEnd = new Date(now - step.afterDays * 24 * 60 * 60 * 1000).toISOString();
    const windowStart = new Date(
      now - (step.afterDays + CATCH_UP_WINDOW_DAYS) * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: candidates, error: candErr } = await supabase
      .from("subscribers")
      .select("email")
      .eq("status", "confirmed")
      .lte("confirmed_at", windowEnd)
      .gte("confirmed_at", windowStart);

    if (candErr) {
      console.error("Subscriber sequence candidate lookup failed", { step: step.templateName, error: candErr });
      continue;
    }
    if (!candidates?.length) continue;

    const emails = Array.from(new Set(candidates.map((c: any) => c.email as string)));

    const { data: alreadySent, error: logErr } = await supabase
      .from("email_send_log")
      .select("recipient_email")
      .eq("template_name", step.templateName)
      .in("recipient_email", emails)
      .in("status", ["pending", "sent"]);

    if (logErr) {
      console.error("Subscriber sequence send-log lookup failed", { step: step.templateName, error: logErr });
      continue;
    }

    const alreadyNotified = new Set((alreadySent ?? []).map((r: any) => r.recipient_email as string));
    const due = emails.filter((e) => !alreadyNotified.has(e));

    for (const email of due) {
      if (await isOptedOut(supabase, email)) continue;
      const ok = await renderAndEnqueue(supabase, step.templateName, email, `${step.templateName}-${email}`);
      if (ok) sentCounts[step.templateName] += 1;
    }
  }

  return {
    step2Sent: sentCounts["subscriber-welcome-2"] ?? 0,
    step3Sent: sentCounts["subscriber-welcome-3"] ?? 0,
  };
}
