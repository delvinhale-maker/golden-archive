import type { SupabaseClient } from "@supabase/supabase-js";
import * as React from "react";
import { render } from "react-email";
import type { Database } from "@/integrations/supabase/types";
import type { CoverAuditResult } from "./cover-audit.server";
import { template as coverAuditAlert } from "./email-templates/cover-audit-alert";

const SITE_NAME = "AurumVault";
const SENDER_DOMAIN = "notify.www.aurumvault.store";
const FROM_DOMAIN = "www.aurumvault.store";
const REPORT_URL = "https://www.aurumvault.store/admin/health/covers";

export interface AlertConfig {
  enabled: boolean;
  threshold: number;
  cooldown_minutes: number;
  recipient_email: string | null;
  webhook_url: string | null;
  last_alert_at: string | null;
}

export interface AlertOutcome {
  triggered: boolean;
  skipped_reason?: string;
  totalFailing: number;
  emailQueued?: boolean;
  webhookOk?: boolean;
  webhookStatus?: number;
}

export async function loadAlertConfig(
  supabase: SupabaseClient<Database>,
): Promise<AlertConfig | null> {
  const { data, error } = await supabase
    .from("cover_audit_alert_config")
    .select("enabled,threshold,cooldown_minutes,recipient_email,webhook_url,last_alert_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AlertConfig | null) ?? null;
}

export async function maybeSendCoverAuditAlert(
  supabase: SupabaseClient<Database>,
  results: CoverAuditResult[],
): Promise<AlertOutcome> {
  const totalFailing = results.reduce((acc, r) => acc + r.summary.failing, 0);
  const config = await loadAlertConfig(supabase);
  if (!config) return { triggered: false, skipped_reason: "no_config", totalFailing };
  if (!config.enabled) return { triggered: false, skipped_reason: "disabled", totalFailing };
  if (totalFailing < config.threshold) {
    return { triggered: false, skipped_reason: "below_threshold", totalFailing };
  }
  if (config.last_alert_at) {
    const elapsedMin = (Date.now() - new Date(config.last_alert_at).getTime()) / 60000;
    if (elapsedMin < config.cooldown_minutes) {
      return { triggered: false, skipped_reason: "cooldown", totalFailing };
    }
  }

  const ranAt = new Date().toISOString();
  const categories = results.map((r) => ({
    category: r.category,
    total: r.summary.total,
    failing: r.summary.failing,
  }));

  let emailQueued: boolean | undefined;
  let webhookOk: boolean | undefined;
  let webhookStatus: number | undefined;

  if (config.recipient_email) {
    try {
      emailQueued = await enqueueAlertEmail(supabase, config.recipient_email, {
        totalFailing,
        threshold: config.threshold,
        ranAt,
        reportUrl: REPORT_URL,
        categories,
      });
    } catch (e) {
      console.error("cover-audit alert email failed", e);
      emailQueued = false;
    }
  }

  if (config.webhook_url) {
    try {
      const res = await fetch(config.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "cover_audit.failures_above_threshold",
          ranAt,
          totalFailing,
          threshold: config.threshold,
          categories,
          reportUrl: REPORT_URL,
        }),
      });
      webhookStatus = res.status;
      webhookOk = res.ok;
    } catch (e) {
      console.error("cover-audit alert webhook failed", e);
      webhookOk = false;
    }
  }

  await supabase
    .from("cover_audit_alert_config")
    .update({ last_alert_at: ranAt })
    .eq("id", 1);

  return { triggered: true, totalFailing, emailQueued, webhookOk, webhookStatus };
}

async function enqueueAlertEmail(
  supabase: SupabaseClient<Database>,
  recipientEmail: string,
  data: {
    totalFailing: number;
    threshold: number;
    ranAt: string;
    reportUrl: string;
    categories: { category: string; total: number; failing: number }[];
  },
): Promise<boolean> {
  const element = React.createElement(coverAuditAlert.component, data);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof coverAuditAlert.subject === "function"
      ? coverAuditAlert.subject(data as unknown as Record<string, unknown>)
      : coverAuditAlert.subject;

  const messageId = crypto.randomUUID();
  const idempotencyKey = `cover-audit-alert-${data.ranAt}`;

  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: "cover-audit-alert",
    recipient_email: recipientEmail,
    status: "pending",
  });

  const { error } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: recipientEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: "cover-audit-alert",
      idempotency_key: idempotencyKey,
      queued_at: new Date().toISOString(),
    },
  });

  if (error) {
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: "cover-audit-alert",
      recipient_email: recipientEmail,
      status: "failed",
      error_message: error.message,
    });
    return false;
  }
  return true;
}
