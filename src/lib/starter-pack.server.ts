import * as React from "react";
import { render } from "react-email";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { STARTER_PACK_URL } from "@/lib/starter-pack";
import { normalizeLeadEmail, sanitizeHeaderValue } from "@/lib/starter-pack-validation";

/** SHA-256 of the caller IP — we never store a raw address. */
export async function callerFingerprint(): Promise<string | null> {
  let headers: Headers;
  try {
    headers = getRequest().headers;
  } catch {
    return null;
  }
  const ip =
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  if (!ip) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`starter-pack:${ip}`));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SITE_NAME = "AurumVault";
const SENDER_DOMAIN = "notify.www.aurumvault.store";
const FROM_DOMAIN = "www.aurumvault.store";
const SITE_URL = "https://www.aurumvault.store";
const DELIVERY_TEMPLATE = "creator-starter-pack-delivery";

export type Attribution = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referringUrl?: string | null;
  landingPage?: string | null;
};

export type CaptureInput = Attribution & {
  firstName: string;
  email: string;
  marketingConsent: boolean;
};

export type CaptureResult = {
  ok: true;
  duplicate: boolean;
  emailQueued: boolean;
  downloadUrl: string;
};

/** Never log a raw address. */
export function redact(email: string): string {
  const [l, d] = email.split("@");
  return l && d ? `${l[0]}***@${d}` : "***";
}

export { normalizeLeadEmail as normalizeEmail } from "@/lib/starter-pack-validation";


export function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server configuration error");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function isOptedOut(supabase: SupabaseClient, email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  // Fail closed: without confirmation of consent state we don't send.
  if (error) return true;
  return Boolean(data);
}

export type SendOutcome =
  | { sent: true; messageId: string }
  | { sent: false; reason: "opted_out" | "template" | "enqueue_failed" | "error" };

/**
 * Renders and queues the Starter Pack delivery email through the platform
 * queue. Status is tracked in email_send_log — a queued row is "queued", not
 * "delivered"; the provider webhook advances it further.
 */
export async function sendStarterPackEmail(
  supabase: SupabaseClient,
  args: { email: string; firstName: string; leadId?: string | null },
): Promise<SendOutcome> {
  try {
    if (await isOptedOut(supabase, args.email)) return { sent: false, reason: "opted_out" };

    const tpl = TEMPLATES[DELIVERY_TEMPLATE];
    if (!tpl) return { sent: false, reason: "template" };

    const downloadUrl = `${SITE_URL}${STARTER_PACK_URL}`;
    const props = {
      siteUrl: SITE_URL,
      firstName: sanitizeHeaderValue(args.firstName),
      downloadUrl,
    };
    const element = React.createElement(tpl.component, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = typeof tpl.subject === "function" ? tpl.subject(props) : tpl.subject;
    const messageId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: DELIVERY_TEMPLATE,
      recipient_email: args.email,
      status: "requested",
      metadata: args.leadId ? { lead_id: args.leadId } : null,
    });

    const { error } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: args.email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: DELIVERY_TEMPLATE,
        // Timestamped so an intentional resend is a new send, while a
        // double-submitted form in the same second stays a single email.
        idempotency_key: `starter-pack-${args.email}-${nowIso.slice(0, 16)}`,
        queued_at: nowIso,
      },
    });

    if (error) {
      console.error("Starter pack enqueue failed", { email: redact(args.email) });
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: DELIVERY_TEMPLATE,
        recipient_email: args.email,
        status: "failed",
        error_message: "enqueue failed",
      });
      return { sent: false, reason: "enqueue_failed" };
    }

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: DELIVERY_TEMPLATE,
      recipient_email: args.email,
      status: "queued",
    });

    return { sent: true, messageId };
  } catch (e) {
    console.error("Starter pack send failed", { email: redact(args.email) });
    return { sent: false, reason: "error" };
  }
}

/**
 * Captures (or refreshes) a Starter Pack lead and queues delivery.
 * Idempotent on normalized_email: a repeat submission updates attribution and
 * bookkeeping instead of creating a second lead record.
 */
export async function captureStarterPackLead(input: CaptureInput): Promise<CaptureResult> {
  const supabase = adminClient();
  const email = normalizeEmail(input.email);
  const firstName = sanitizeHeaderValue(input.firstName).slice(0, 80);
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabase
    .from("creator_leads")
    .select("id, marketing_consent, consent_at, starter_pack_send_count")
    .eq("normalized_email", email)
    .maybeSingle();

  const attribution = {
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_campaign: input.utmCampaign ?? null,
    utm_content: input.utmContent ?? null,
    utm_term: input.utmTerm ?? null,
    referring_url: input.referringUrl ?? null,
    landing_page: input.landingPage ?? null,
  };

  let leadId: string | null = existing?.id ?? null;

  if (existing) {
    // Only fill attribution gaps — never overwrite the original source.
    const patch: Record<string, unknown> = {
      first_name: firstName || undefined,
      starter_pack_requested_at: nowIso,
      updated_at: nowIso,
    };
    for (const [k, v] of Object.entries(attribution)) {
      if (v) patch[k] = v;
    }
    // Consent is additive: opting in upgrades, submitting again never revokes.
    if (input.marketingConsent && !existing.marketing_consent) {
      patch.marketing_consent = true;
      patch.consent_at = nowIso;
      patch.consent_source = "creator-starter-pack";
    }
    const { error } = await supabase.from("creator_leads").update(patch).eq("id", existing.id);
    if (error) {
      console.error("Starter pack lead update failed", { email: redact(email) });
      throw new Error("We couldn't save your details. Please try again.");
    }
  } else {
    const { data: inserted, error } = await supabase
      .from("creator_leads")
      .insert({
        email,
        normalized_email: email,
        first_name: firstName || null,
        acquisition_type: "CREATOR_STARTER_PACK",
        lead_status: "NEW",
        marketing_consent: input.marketingConsent,
        consent_at: input.marketingConsent ? nowIso : null,
        consent_source: input.marketingConsent ? "creator-starter-pack" : null,
        cta_source: "creator-starter-pack",
        product_type: "Starter Pack",
        follower_count: 0,
        starter_pack_requested_at: nowIso,
        ...attribution,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("Starter pack lead insert failed", { email: redact(email) });
      throw new Error("We couldn't save your details. Please try again.");
    }
    leadId = inserted?.id ?? null;
  }

  const outcome = await sendStarterPackEmail(supabase, { email, firstName, leadId });

  await supabase
    .from("creator_leads")
    .update({
      starter_pack_last_sent_at: outcome.sent ? nowIso : null,
      starter_pack_send_count: (existing?.starter_pack_send_count ?? 0) + (outcome.sent ? 1 : 0),
      last_send_status: outcome.sent ? "queued" : `failed:${outcome.reason}`,
      lead_status: outcome.sent ? "STARTER_PACK_SENT" : "NEW",
      updated_at: nowIso,
    })
    .eq("normalized_email", email);

  return {
    ok: true,
    duplicate: Boolean(existing),
    emailQueued: outcome.sent,
    downloadUrl: STARTER_PACK_URL,
  };
}
