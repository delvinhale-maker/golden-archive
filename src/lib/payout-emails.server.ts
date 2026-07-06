// Server-only helper to send creator-facing payout notification emails
// via the shared pgmq transactional_emails queue.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PayoutEmailKind = "submitted" | "approved" | "paid" | "declined";

interface PayoutEmailInput {
  kind: PayoutEmailKind;
  sellerId: string;
  amountCents: number;
  currency?: string;
  method?: string | null;
  adminNote?: string | null;
  requestId: string;
}

function fmtAmount(cents: number, currency = "usd") {
  const dollars = (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${dollars} ${currency.toUpperCase()}`;
}

const SITE = "https://www.aurumvault.store";
const DASH_URL = `${SITE}/dashboard/payouts`;

function renderEmail(opts: {
  title: string;
  intro: string;
  amount: string;
  extra?: string;
  cta?: { label: string; href: string };
}) {
  const { title, intro, amount, extra, cta } = opts;
  const extraHtml = extra
    ? `<p style="margin:0 0 16px;font-size:14px;color:#5A6478;line-height:1.5">${extra}</p>`
    : "";
  const ctaHtml = cta
    ? `<p style="text-align:center;margin:24px 0 8px"><a href="${cta.href}" style="background:#0F1A33;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">${cta.label}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;font-family:Inter,Arial,sans-serif;color:#0F1A33">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="padding:20px 24px;background:#0F1A33;border-radius:12px 12px 0 0;text-align:center">
    <div style="color:#C9A24B;font-size:12px;letter-spacing:.3em;text-transform:uppercase;font-weight:600">AurumVault</div>
    <div style="color:#fff;font-family:Georgia,serif;font-size:22px;margin-top:6px;font-weight:600">Payouts</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-radius:0 0 12px 12px;padding:32px 28px">
    <h1 style="font-family:Georgia,serif;font-size:24px;color:#0F1A33;margin:0 0 12px;font-weight:600">${title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#0F1A33;margin:0 0 16px">${intro}</p>
    <div style="background:#FAF8F3;border:1px solid #E5E7EB;border-radius:8px;padding:14px 16px;margin:8px 0 16px;font-size:15px;color:#0F1A33">
      <strong>Amount:</strong> ${amount}
    </div>
    ${extraHtml}
    ${ctaHtml}
    <p style="font-size:13px;color:#5A6478;margin:16px 0 0">Track all payout activity from your dashboard.</p>
  </div>
</div></body></html>`;
}

function buildEmail(kind: PayoutEmailKind, amountStr: string, adminNote?: string | null, method?: string | null) {
  switch (kind) {
    case "submitted":
      return {
        subject: `Payout request received — ${amountStr}`,
        html: renderEmail({
          title: "We received your payout request",
          intro:
            "Thanks — your payout request is now in review. Our team typically processes requests within 3 business days.",
          amount: amountStr,
          cta: { label: "View request", href: DASH_URL },
        }),
      };
    case "approved":
      return {
        subject: `Payout approved — ${amountStr}`,
        html: renderEmail({
          title: "Your payout was approved",
          intro:
            "Your payout request has been approved and is queued for payment. You'll get another email as soon as it is sent.",
          amount: amountStr,
          extra: adminNote ? `Note from admin: ${adminNote}` : undefined,
          cta: { label: "View status", href: DASH_URL },
        }),
      };
    case "paid":
      return {
        subject: `Payout sent — ${amountStr}`,
        html: renderEmail({
          title: "Your payout is on the way",
          intro: `We've sent your payout${method ? ` via ${method}` : ""}. Depending on your bank or provider it may take 1–3 business days to arrive.`,
          amount: amountStr,
          extra: adminNote ? `Reference: ${adminNote}` : undefined,
          cta: { label: "View payout history", href: DASH_URL },
        }),
      };
    case "declined":
      return {
        subject: `Payout request declined`,
        html: renderEmail({
          title: "Your payout request was declined",
          intro:
            "We weren't able to process this payout request. You can review the details and submit a new request when you're ready.",
          amount: amountStr,
          extra: adminNote ? `Reason: ${adminNote}` : "Reply to this email if you'd like more detail.",
          cta: { label: "Open payouts", href: DASH_URL },
        }),
      };
  }
}

export async function sendPayoutEmail(input: PayoutEmailInput): Promise<void> {
  try {
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(input.sellerId);
    if (userErr || !userRes?.user?.email) return;
    // Only send to verified addresses to protect deliverability and prevent
    // notifying unconfirmed / potentially spoofed emails.
    const u = userRes.user;
    const confirmed = Boolean(u.email_confirmed_at || (u as any).confirmed_at);
    if (!confirmed) {
      console.warn("sendPayoutEmail: skipping unverified email", { sellerId: input.sellerId });
      return;
    }
    const to = u.email;
    const amountStr = fmtAmount(input.amountCents, input.currency);
    const { subject, html } = buildEmail(input.kind, amountStr, input.adminNote, input.method);
    const text = `${subject}. ${amountStr}. View: ${DASH_URL}`;

    await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to,
        from: "AurumVault <noreply@www.aurumvault.store>",
        sender_domain: "notify.www.aurumvault.store",
        subject,
        html,
        text,
        purpose: "transactional",
        label: `payout-${input.kind}`,
        idempotency_key: `payout-${input.kind}-${input.requestId}`,
        queued_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    // Never let email failure block payout flow
    console.error("sendPayoutEmail failed", e);
  }
}
