import * as React from "react";
import { render } from "react-email";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { adminClient, getOrCreateUnsubscribeToken, redact } from "@/lib/starter-pack.server";
import { FOUNDING_CAMPAIGN, FOUNDING_COHORT_SIZE, formatFoundingNumber } from "@/lib/founding";

const SITE_NAME = "AurumVault";
const SENDER_DOMAIN = "notify.www.aurumvault.store";
const FROM_DOMAIN = "www.aurumvault.store";
export const SITE_URL = "https://www.aurumvault.store";
const ACCEPTANCE_TEMPLATE = "founding-creator-accepted";

export { adminClient };

/** Renders and queues a template email through the existing platform queue. */
export async function queueTemplateEmail(
  supabase: SupabaseClient,
  args: {
    template: string;
    to: string;
    props: Record<string, unknown>;
    idempotencyKey: string;
    metadata?: Record<string, unknown> | null;
  },
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const { data: suppressed, error: supErr } = await supabase
      .from("suppressed_emails")
      .select("id")
      .eq("email", args.to)
      .maybeSingle();
    // Fail closed — without a clear consent state we do not send.
    if (supErr || suppressed) return { sent: false, reason: "opted_out" };

    const tpl = TEMPLATES[args.template];
    if (!tpl) return { sent: false, reason: "template" };

    const element = React.createElement(tpl.component, args.props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject =
      typeof tpl.subject === "function" ? tpl.subject(args.props as Record<string, any>) : tpl.subject;
    const messageId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: args.template,
      recipient_email: args.to,
      status: "pending",
      metadata: args.metadata ?? null,
    });

    // The mail platform rejects sends without a one-click unsubscribe token,
    // so this is a hard requirement rather than an optional field.
    const unsubscribeToken = await getOrCreateUnsubscribeToken(supabase, args.to);
    if (!unsubscribeToken) {
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: args.template,
        recipient_email: args.to,
        status: "failed",
        error_message: "missing_unsubscribe_token",
      });
      return { sent: false, reason: "missing_unsubscribe_token" };
    }

    const { error } = await supabase.rpc("enqueue_email", {
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
        label: args.template,
        idempotency_key: args.idempotencyKey,
        queued_at: nowIso,
        ...(unsubscribeToken ? { unsubscribe_token: unsubscribeToken } : {}),
      },
    });

    if (error) {
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: args.template,
        recipient_email: args.to,
        status: "failed",
        error_message: "enqueue failed",
      });
      return { sent: false, reason: "enqueue_failed" };
    }
    return { sent: true };
  } catch {
    console.error("Founding email send failed", { email: redact(args.to) });
    return { sent: false, reason: "error" };
  }
}

export type AcceptResult = {
  foundingNumber: number;
  cohortFull: boolean;
  emailQueued: boolean;
};

/**
 * Accepts an approved creator into the Founding 100. The founding number is
 * assigned by the database function (transactional, capped, idempotent) — never
 * chosen by the caller. The recipient address is read from stored records only.
 */
export async function acceptFoundingCreator(args: {
  applicationId: string;
  acceptedBy: string;
}): Promise<AcceptResult> {
  const supabase = adminClient();

  const { data: app, error } = await supabase
    .from("seller_applications")
    .select("id, user_id, brand_name, brand_slug, status, applicant_email, campaign_source, creator_lead_id")
    .eq("id", args.applicationId)
    .maybeSingle();
  if (error || !app) throw new Error("Application not found");
  if (app.status !== "approved") {
    throw new Error("Approve the application before accepting into the Founding 100.");
  }

  const { data: assigned, error: assignError } = await supabase.rpc("assign_founding_creator", {
    _user_id: app.user_id as string,
    _application_id: app.id as string,
    _lead_id: (app.creator_lead_id as string | null) ?? null,
    _campaign_source: (app.campaign_source as string | null) ?? FOUNDING_CAMPAIGN,
    _accepted_by: args.acceptedBy,
  });
  if (assignError) throw new Error(assignError.message);
  const foundingNumber = Number(assigned);

  // Keep lead-side funnel reporting truthful.
  if (app.creator_lead_id) {
    await supabase
      .from("creator_leads")
      .update({
        converted_to_creator_at: new Date().toISOString(),
        lead_status: "CREATOR_APPROVED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", app.creator_lead_id as string);
  }

  await supabase
    .from("creator_activation")
    .upsert(
      { user_id: app.user_id as string, approved_at: new Date().toISOString() },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  let emailQueued = false;
  const email = app.applicant_email as string | null;
  if (email) {
    const outcome = await queueTemplateEmail(supabase, {
      template: ACCEPTANCE_TEMPLATE,
      to: email,
      idempotencyKey: `founding-accepted-${app.id}`,
      metadata: { application_id: app.id, founding_number: foundingNumber },
      props: {
        siteUrl: SITE_URL,
        brandName: (app.brand_name as string) || "Creator",
        foundingNumber,
        foundingLabel: formatFoundingNumber(foundingNumber),
        storefrontUrl: app.brand_slug ? `${SITE_URL}/store/${app.brand_slug}` : null,
        dashboardUrl: `${SITE_URL}/dashboard`,
        launchKitUrl: `${SITE_URL}/dashboard/launch-kit`,
      },
    });
    emailQueued = outcome.sent;
  }

  const { count } = await supabase
    .from("founding_creators")
    .select("founding_number", { count: "exact", head: true });

  return {
    foundingNumber,
    cohortFull: (count ?? 0) >= FOUNDING_COHORT_SIZE,
    emailQueued,
  };
}
