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

/**
 * Renders and queues the Seller Starter Kit confirmation email.
 * Best-effort: never throws — lead capture must succeed even if email fails.
 */
export async function sendCreatorStarterKitEmail(email: string, productType: string): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error("Starter kit email skipped: missing server configuration");
      return;
    }
    const tpl = TEMPLATES[TEMPLATE_NAME];
    if (!tpl) {
      console.error("Starter kit email skipped: template missing");
      return;
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (suppressed) return;

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
    }
  } catch (e) {
    console.error("Starter kit email failed", e);
  }
}
