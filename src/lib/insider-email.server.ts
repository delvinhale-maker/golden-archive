import * as React from "react";
import { render } from "react-email";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";

export const SITE_NAME = "AurumVault";
export const SENDER_NAME = "AurumVault Insider";
export const SENDER_DOMAIN = "notify.www.aurumvault.store";
export const FROM_DOMAIN = "www.aurumvault.store";
export const SITE_URL = "https://www.aurumvault.store";

export function insiderAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server configuration error");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * One durable unsubscribe token per address, reusing the shared
 * `email_unsubscribe_tokens` table the transactional sender already uses.
 * Returns null when a token can't be established — callers must then skip the
 * send rather than mail without an unsubscribe path.
 */
export async function getOrCreateUnsubscribeToken(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const normalized = email.toLowerCase();
  const { data: existing } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalized)
    .maybeSingle();
  if (existing?.token) return existing.token as string;

  const token = randomToken();
  const { error } = await supabase
    .from("email_unsubscribe_tokens")
    .upsert({ token, email: normalized }, { onConflict: "email" });
  if (error) {
    console.error("insider: unsubscribe token create failed", { error });
    return null;
  }
  const { data: stored } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalized)
    .maybeSingle();
  return (stored?.token as string | undefined) ?? null;
}

export function unsubscribeUrlFor(token: string): string {
  return `${SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function isSuppressed(supabase: SupabaseClient, email: string): Promise<boolean> {
  const { data } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return Boolean(data);
}

export interface EnqueueInsiderEmailInput {
  templateName: string;
  to: string;
  props: Record<string, unknown>;
  subject?: string;
  idempotencyKey: string;
  purpose?: "marketing" | "transactional";
}

/**
 * Renders and enqueues an Insider email through the existing pgmq
 * transactional queue. Idempotency key guards against duplicate sends on
 * retry; suppression and unsubscribe tokens are handled by the caller/here.
 */
export async function enqueueInsiderEmail(
  supabase: SupabaseClient,
  input: EnqueueInsiderEmailInput,
): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
  const email = input.to.toLowerCase();
  if (await isSuppressed(supabase, email)) return { ok: false, reason: "suppressed" };

  const tpl = TEMPLATES[input.templateName];
  if (!tpl) return { ok: false, reason: "template_missing" };

  const token = await getOrCreateUnsubscribeToken(supabase, email);
  if (!token) return { ok: false, reason: "unsubscribe_token_failed" };

  const props = { siteUrl: SITE_URL, unsubscribeUrl: unsubscribeUrlFor(token), ...input.props };
  const element = React.createElement(tpl.component, props as any);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    input.subject ??
    (typeof tpl.subject === "function" ? tpl.subject(props as any) : tpl.subject);
  const messageId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const { error } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: email,
      from: `${SENDER_NAME} <noreply@${FROM_DOMAIN}>`,
      reply_to: `support@aurumvault.tech`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: input.purpose ?? "marketing",
      label: input.templateName,
      idempotency_key: input.idempotencyKey,
      unsubscribe_token: token,
      queued_at: nowIso,
    },
  });

  if (error) {
    console.error("insider: enqueue failed", { template: input.templateName, error });
    return { ok: false, reason: "enqueue_failed" };
  }

  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: input.templateName,
    recipient_email: email,
    status: "pending",
  });

  return { ok: true, messageId };
}
