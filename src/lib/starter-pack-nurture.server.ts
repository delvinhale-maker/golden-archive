import * as React from "react";
import { render } from "react-email";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { adminClient, redact } from "@/lib/starter-pack.server";

const SITE_NAME = "AurumVault";
const SENDER_DOMAIN = "notify.www.aurumvault.store";
const FROM_DOMAIN = "www.aurumvault.store";
const SITE_URL = "https://www.aurumvault.store";

/** Marketing drip — only ever sent to leads with explicit marketing consent. */
const STEPS = [
  { template: "creator-nurture-2", column: "nurture_step2_sent_at", afterDays: 2 },
  { template: "creator-nurture-3", column: "nurture_step3_sent_at", afterDays: 4 },
  { template: "creator-nurture-4", column: "nurture_step4_sent_at", afterDays: 7 },
  { template: "creator-nurture-5", column: "nurture_step5_sent_at", afterDays: 10 },
] as const;

const BATCH_SIZE = 200;

export type NurtureResult = { sent: number; failed: number; skipped: number; byStep: Record<string, number> };

/**
 * Advances the Starter Pack nurture sequence one step per lead per run.
 * Idempotent: each step writes its own sent_at column, so re-running is safe.
 */
export async function runStarterPackNurture(): Promise<NurtureResult> {
  const supabase = adminClient();
  const result: NurtureResult = { sent: 0, failed: 0, skipped: 0, byStep: {} };

  for (const cfg of STEPS) {
    const cutoff = new Date(Date.now() - cfg.afterDays * 86_400_000).toISOString();
    const { data: rows, error } = await supabase
      .from("creator_leads")
      .select("id, email, normalized_email, first_name, starter_pack_requested_at")
      .eq("acquisition_type", "CREATOR_STARTER_PACK")
      .eq("marketing_consent", true)
      .not("starter_pack_requested_at", "is", null)
      .lte("starter_pack_requested_at", cutoff)
      .is(cfg.column, null)
      .limit(BATCH_SIZE);
    if (error) throw error;
    if (!rows?.length) continue;

    const emails = rows.map((r: any) => r.normalized_email ?? r.email);
    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("email")
      .in("email", emails);
    const blocked = new Set((suppressed ?? []).map((s: any) => s.email));

    const tpl = TEMPLATES[cfg.template];
    if (!tpl) throw new Error(`Template missing: ${cfg.template}`);

    for (const row of rows as any[]) {
      const email = row.normalized_email ?? row.email;
      if (blocked.has(email)) {
        // Mark done so a suppressed lead never blocks later steps.
        await supabase.from("creator_leads").update({ [cfg.column]: new Date().toISOString() }).eq("id", row.id);
        result.skipped += 1;
        continue;
      }

      const unsubscribeUrl = `${SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}`;
      const props = { siteUrl: SITE_URL, firstName: row.first_name ?? "", unsubscribeUrl };
      const element = React.createElement(tpl.component, props);
      const html = await render(element);
      const text = await render(element, { plainText: true });
      const subject = typeof tpl.subject === "function" ? tpl.subject(props) : tpl.subject;
      const messageId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: cfg.template,
        recipient_email: email,
        status: "pending",
        metadata: { lead_id: row.id },
      });

      const { error: enqErr } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: email,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: "marketing",
          label: cfg.template,
          idempotency_key: `${cfg.template}-${row.id}`,
          queued_at: nowIso,
        },
      });

      if (enqErr) {
        console.error("Nurture enqueue failed", { step: cfg.template, email: redact(email) });
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: cfg.template,
          recipient_email: email,
          status: "failed",
          error_message: "enqueue failed",
        });
        result.failed += 1;
        continue;
      }

      await supabase.from("creator_leads").update({ [cfg.column]: nowIso, lead_status: "ENGAGED" }).eq("id", row.id);
      result.sent += 1;
      result.byStep[cfg.template] = (result.byStep[cfg.template] ?? 0) + 1;
    }
  }

  return result;
}
