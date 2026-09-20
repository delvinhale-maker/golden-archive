/**
 * AurumVault Business Certificate & License Wallet™ — expiration reminder
 * runner. Server-only; invoked by the public cron route.
 *
 * Reuses AurumVault's EXISTING email infrastructure: the `enqueue_email`
 * database function feeding the `transactional_emails` queue (same path
 * payout-emails.server.ts uses), with an `idempotency_key` per reminder. A
 * unique row in `license_wallet_reminder_log`
 * (document_id, offset_days, reminder_for_date) is the durable guard, so
 * repeat runs never double-send.
 */
import {
  REMINDER_OFFSETS,
  WALLET_PLANS,
  DEFAULT_WALLET_PLAN,
  dueReminderOffset,
  isWalletPlan,
  isReminderMilestoneEnabled,
  normalizeReminderOffsets,
  reminderSubject,
  CATEGORY_LABELS,
  isLicenseWalletCategory,
  type WalletPlan,
} from "@/lib/license-wallet";

const SITE_URL = "https://www.aurumvault.store";
const WALLET_URL = `${SITE_URL}/dashboard/license-wallet`;

type DocRow = {
  id: string;
  owner_user_id: string;
  title: string;
  category: string;
  issuer: string | null;
  expiration_date: string;
};

function html(doc: DocRow, offset: number): string {
  const when = offset === 0 ? "today" : `in ${offset} day${offset === 1 ? "" : "s"}`;
  const cat = isLicenseWalletCategory(doc.category) ? CATEGORY_LABELS[doc.category] : doc.category;
  return `<!doctype html><html><body style="margin:0;background:#0f1e35;padding:32px 16px;font-family:Georgia,serif">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fffdf7;border-radius:12px">
    <tr><td style="padding:28px 28px 8px">
      <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#b8860b;font-weight:700">AurumVault · License Wallet</div>
      <h1 style="margin:8px 0 0;font-size:22px;color:#0f1e35">${escapeHtml(doc.title)} expires ${when}</h1>
    </td></tr>
    <tr><td style="padding:8px 28px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#404a5c;line-height:1.6">
      <p style="margin:0 0 12px">${escapeHtml(cat)}${doc.issuer ? ` · ${escapeHtml(doc.issuer)}` : ""}</p>
      <p style="margin:0 0 12px">Expiration date: <strong>${doc.expiration_date}</strong></p>
      <p style="margin:0 0 20px">Renew it and upload the new document so your records stay current.</p>
      <a href="${WALLET_URL}" style="display:inline-block;background:#b8860b;color:#0f1e35;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;font-size:13px">Open License Wallet</a>
    </td></tr>
    <tr><td style="padding:24px 28px 28px;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#8a93a3">
      You're receiving this because expiration reminders are on in your AurumVault License Wallet settings.
    </td></tr>
  </table></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export type ReminderRunResult = {
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
};

export async function runLicenseWalletReminders(
  today: string = new Date().toISOString().slice(0, 10),
): Promise<ReminderRunResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result: ReminderRunResult = { candidates: 0, sent: 0, skipped: 0, failed: 0 };

  const targetDates = REMINDER_OFFSETS.map((o) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + o);
    return d.toISOString().slice(0, 10);
  });

  const { data: docs, error } = await (supabaseAdmin as any)
    .from("license_wallet_documents")
    .select("id,owner_user_id,title,category,issuer,expiration_date")
    .eq("no_expiration", false)
    .in("expiration_date", targetDates);
  if (error) throw new Error(error.message);

  const rows = (docs ?? []) as DocRow[];
  result.candidates = rows.length;
  if (rows.length === 0) return result;

  const owners = Array.from(new Set(rows.map((r) => r.owner_user_id)));
  const [{ data: settings }, { data: ents }] = await Promise.all([
    (supabaseAdmin as any)
      .from("license_wallet_reminder_settings")
      .select("owner_user_id,enabled,recipient_email,offsets")
      .in("owner_user_id", owners),
    (supabaseAdmin as any)
      .from("license_wallet_entitlements")
      .select("user_id,plan,status")
      .in("user_id", owners),
  ]);

  const settingsByOwner = new Map<
    string,
    { enabled: boolean; recipient_email: string | null; offsets: number[] }
  >();
  for (const s of (settings ?? []) as any[]) {
    settingsByOwner.set(s.owner_user_id, {
      enabled: s.enabled,
      recipient_email: s.recipient_email,
      offsets: normalizeReminderOffsets(s.offsets),
    });
  }
  const planByOwner = new Map<string, WalletPlan>();
  for (const e of (ents ?? []) as any[]) {
    planByOwner.set(e.user_id, e.status === "active" && isWalletPlan(e.plan) ? e.plan : DEFAULT_WALLET_PLAN);
  }

  const emailCache = new Map<string, string | null>();
  async function ownerEmail(userId: string): Promise<string | null> {
    if (emailCache.has(userId)) return emailCache.get(userId)!;
    let email: string | null = null;
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
      email = data?.user?.email ?? null;
    } catch {
      email = null;
    }
    emailCache.set(userId, email);
    return email;
  }

  for (const doc of rows) {
    const offset = dueReminderOffset(doc, today);
    if (offset === null) {
      result.skipped += 1;
      continue;
    }
    const plan = planByOwner.get(doc.owner_user_id) ?? DEFAULT_WALLET_PLAN;
    if (!WALLET_PLANS[plan].remindersEnabled) {
      result.skipped += 1;
      continue;
    }
    const setting = settingsByOwner.get(doc.owner_user_id);
    if (setting && setting.enabled === false) {
      result.skipped += 1;
      continue;
    }
    // Owner-selected milestones (defaults apply when no settings row exists).
    if (!isReminderMilestoneEnabled(setting?.offsets ?? null, offset)) {
      result.skipped += 1;
      continue;
    }
    const to = setting?.recipient_email || (await ownerEmail(doc.owner_user_id));
    if (!to) {
      result.skipped += 1;
      continue;
    }

    // Durable idempotency: unique (document_id, offset_days, reminder_for_date).
    const { error: logErr } = await (supabaseAdmin as any)
      .from("license_wallet_reminder_log")
      .insert({
        owner_user_id: doc.owner_user_id,
        document_id: doc.id,
        offset_days: offset,
        reminder_for_date: doc.expiration_date,
        recipient_email: to,
      });
    if (logErr) {
      result.skipped += 1; // already sent (unique violation) or transient
      continue;
    }

    const subject = reminderSubject(doc.title, offset);
    // Truthful send accounting: supabase-js returns `{ error }` rather than
    // throwing, so inspect it. On failure we release the idempotency guard row
    // so the next daily run can retry this milestone instead of silently
    // dropping it (and we never report it as sent).
    try {
      const { error: rpcErr } = await (supabaseAdmin as any).rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to,
          from: "AurumVault <noreply@www.aurumvault.store>",
          sender_domain: "notify.www.aurumvault.store",
          subject,
          html: html(doc, offset),
          text: `${subject}. Expiration date: ${doc.expiration_date}. Open ${WALLET_URL}`,
          purpose: "transactional",
          label: "license-wallet-reminder",
          idempotency_key: `wallet-reminder-${doc.id}-${offset}-${doc.expiration_date}`,
          queued_at: new Date().toISOString(),
        },
      });
      if (rpcErr) throw new Error(rpcErr.message);
      result.sent += 1;
    } catch (e) {
      console.error("[license-wallet] reminder enqueue failed", e);
      result.failed += 1;
      await (supabaseAdmin as any)
        .from("license_wallet_reminder_log")
        .delete()
        .eq("document_id", doc.id)
        .eq("offset_days", offset)
        .eq("reminder_for_date", doc.expiration_date);
    }

  }

  return result;
}