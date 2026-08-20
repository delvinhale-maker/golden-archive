import * as React from "react";
import { render } from "react-email";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "AurumVault";
const SENDER_DOMAIN = "notify.www.aurumvault.store";
const FROM_DOMAIN = "www.aurumvault.store";
const SITE_URL = "https://www.aurumvault.store";

const STEPS = [
  { step: 2, template: "subscriber-sequence-2", column: "sequence_step2_sent_at", afterDays: 3 },
  { step: 3, template: "subscriber-sequence-3", column: "sequence_step3_sent_at", afterDays: 6 },
] as const;

const BATCH_SIZE = 200;

export type SequenceResult = { sent: number; failed: number; byStep: Record<string, number> };

/**
 * Sends steps 2 and 3 of the subscriber welcome sequence to confirmed
 * subscribers whose confirmation is old enough and who haven't received that
 * step yet. Idempotent: the per-step sent_at column and the email idempotency
 * key both guard against duplicates, so running more often is harmless.
 */
export async function runSubscriberSequence(): Promise<SequenceResult> {
  const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Server configuration error");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result: SequenceResult = { sent: 0, failed: 0, byStep: {} };

  for (const cfg of STEPS) {
    const cutoff = new Date(Date.now() - cfg.afterDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("subscribers")
      .select("id,email,confirmed_at")
      .eq("status", "confirmed")
      .not("confirmed_at", "is", null)
      .lte("confirmed_at", cutoff)
      .is(cfg.column, null)
      .limit(BATCH_SIZE);
    if (error) throw error;
    if (!rows?.length) continue;

    // Skip anyone on the suppression list.
    const emails = rows.map((r: any) => r.email);
    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("email")
      .in("email", emails);
    const blocked = new Set((suppressed ?? []).map((s: any) => s.email));

    const tpl = TEMPLATES[cfg.template];
    if (!tpl) throw new Error(`Template missing: ${cfg.template}`);

    for (const row of rows as any[]) {
      if (blocked.has(row.email)) {
        await supabase
          .from("subscribers")
          .update({ [cfg.column]: new Date().toISOString() })
          .eq("id", row.id);
        continue;
      }

      const unsubscribeUrl = `${SITE_URL}/unsubscribe?email=${encodeURIComponent(row.email)}`;
      const props = { siteUrl: SITE_URL, unsubscribeUrl };
      const element = React.createElement(tpl.component, props);
      const html = await render(element);
      const text = await render(element, { plainText: true });
      const subject = typeof tpl.subject === "function" ? tpl.subject(props) : tpl.subject;
      const messageId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      const { error: enqErr } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: row.email,
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
        console.error("subscriber sequence enqueue failed", { step: cfg.step, error: enqErr });
        result.failed += 1;
        continue;
      }

      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: cfg.template,
        recipient_email: row.email,
        status: "pending",
      });
      await supabase.from("subscribers").update({ [cfg.column]: nowIso }).eq("id", row.id);

      result.sent += 1;
      result.byStep[`step${cfg.step}`] = (result.byStep[`step${cfg.step}`] ?? 0) + 1;
    }
  }

  return result;
}
