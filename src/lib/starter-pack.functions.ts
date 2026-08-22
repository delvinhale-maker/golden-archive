import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_PER_HOUR,
  looksAutomated,
  starterPackSubmitSchema,
} from "@/lib/starter-pack-validation";

/**
 * Public Starter Pack lead capture. No auth: anonymous visitors submit here and
 * only here — the leads table itself is not readable or writable from a browser.
 */
export const submitStarterPackLead = createServerFn({ method: "POST" })
  .inputValidator((data) => starterPackSubmitSchema.parse(data))
  .handler(async ({ data }) => {
    if (looksAutomated(data)) {
      return { ok: true as const, duplicate: false, emailQueued: false, bot: true };
    }

    const { captureStarterPackLead, adminClient, callerFingerprint } = await import(
      "@/lib/starter-pack.server"
    );

    const ipHash = await callerFingerprint();
    if (ipHash) {
      const { data: allowed } = await adminClient().rpc("check_creator_lead_rate_limit", {
        _ip_hash: ipHash,
        _max_per_hour: MAX_PER_HOUR,
      });
      if (allowed === false) {
        throw new Error("Too many requests from this connection. Please try again in an hour.");
      }
    }

    const result = await captureStarterPackLead({
      firstName: data.firstName,
      email: data.email,
      marketingConsent: data.marketingConsent,
      utmSource: data.utmSource ?? null,
      utmMedium: data.utmMedium ?? null,
      utmCampaign: data.utmCampaign ?? null,
      utmContent: data.utmContent ?? null,
      utmTerm: data.utmTerm ?? null,
      referringUrl: data.referringUrl ?? null,
      landingPage: data.landingPage ?? null,
    });

    return { ...result, bot: false as const };
  });

/** Admin-only: retry a failed Starter Pack delivery for one existing lead. */
export const retryStarterPackEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) =>
    z.object({ leadId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { adminClient, sendStarterPackEmail } = await import("@/lib/starter-pack.server");
    const supabase = adminClient();

    // Recipient comes from the stored lead, never from the request body.
    const { data: lead, error } = await supabase
      .from("creator_leads")
      .select("id, normalized_email, email, first_name, starter_pack_send_count")
      .eq("id", data.leadId)
      .maybeSingle();
    if (error || !lead) throw new Error("Lead not found");

    const email = (lead.normalized_email ?? lead.email) as string;
    const outcome = await sendStarterPackEmail(supabase, {
      email,
      firstName: (lead.first_name as string | null) ?? "",
      leadId: lead.id as string,
    });

    const nowIso = new Date().toISOString();
    await supabase
      .from("creator_leads")
      .update({
        last_send_status: outcome.sent ? "queued" : `failed:${outcome.reason}`,
        starter_pack_last_sent_at: outcome.sent ? nowIso : undefined,
        starter_pack_send_count:
          ((lead.starter_pack_send_count as number) ?? 0) + (outcome.sent ? 1 : 0),
        lead_status: outcome.sent ? "STARTER_PACK_SENT" : undefined,
        updated_at: nowIso,
      })
      .eq("id", lead.id);

    if (!outcome.sent) {
      throw new Error(
        outcome.reason === "opted_out"
          ? "This address has unsubscribed or bounced, so we can't email it again."
          : "The email could not be queued. Please try again.",
      );
    }
    return { ok: true as const };
  });

export type CreatorAcquisitionLead = {
  id: string;
  firstName: string | null;
  email: string;
  leadStatus: string;
  marketingConsent: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPage: string | null;
  sendStatus: string | null;
  sendCount: number;
  lastSentAt: string | null;
  applicationId: string | null;
  convertedAt: string | null;
  createdAt: string;
};

export type CreatorAcquisitionMetrics = {
  days: number;
  signups: number;
  uniqueLeads: number;
  marketingOptIns: number;
  emailsQueued: number;
  emailsDelivered: number;
  emailFailures: number;
  downloadClicks: number;
  applicationClicks: number;
  applicationsSubmitted: number;
  approvedCreators: number;
  topSources: { key: string; count: number }[];
  topCampaigns: { key: string; count: number }[];
  recentFailures: CreatorAcquisitionLead[];
  leads: CreatorAcquisitionLead[];
};

function tally(values: (string | null)[]): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const v of values) {
    const key = v?.trim() || "direct / none";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

/** Admin-only Creator Acquisition dashboard data. */
export const getCreatorAcquisitionMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number } | undefined) => ({
    days: Math.min(Math.max(input?.days ?? 30, 1), 365),
  }))
  .handler(async ({ context, data }): Promise<CreatorAcquisitionMetrics> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { adminClient } = await import("@/lib/starter-pack.server");
    const supabase = adminClient();
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const [leadsRes, clicksRes] = await Promise.all([
      supabase
        .from("creator_leads")
        .select(
          "id, first_name, email, normalized_email, lead_status, marketing_consent, utm_source, utm_medium, utm_campaign, landing_page, last_send_status, starter_pack_send_count, starter_pack_last_sent_at, seller_application_id, converted_to_creator_at, created_at",
        )
        .eq("acquisition_type", "CREATOR_STARTER_PACK")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("cta_click_events")
        .select("cta_location, created_at")
        .gte("created_at", since)
        .limit(20000),
    ]);
    if (leadsRes.error) throw leadsRes.error;
    if (clicksRes.error) throw clicksRes.error;

    const rows = leadsRes.data ?? [];
    const leads: CreatorAcquisitionLead[] = rows.map((r: any) => ({
      id: r.id,
      firstName: r.first_name,
      email: r.normalized_email ?? r.email,
      leadStatus: r.lead_status,
      marketingConsent: Boolean(r.marketing_consent),
      utmSource: r.utm_source,
      utmMedium: r.utm_medium,
      utmCampaign: r.utm_campaign,
      landingPage: r.landing_page,
      sendStatus: r.last_send_status,
      sendCount: r.starter_pack_send_count ?? 0,
      lastSentAt: r.starter_pack_last_sent_at,
      applicationId: r.seller_application_id,
      convertedAt: r.converted_to_creator_at,
      createdAt: r.created_at,
    }));

    const emails = [...new Set(leads.map((l) => l.email))];
    let delivered = 0;
    if (emails.length > 0) {
      const { data: sends } = await supabase
        .from("email_send_log")
        .select("recipient_email, status")
        .eq("template_name", "creator-starter-pack-delivery")
        .in("status", ["sent", "delivered"])
        .in("recipient_email", emails)
        .limit(20000);
      delivered = new Set((sends ?? []).map((s: any) => s.recipient_email)).size;
    }

    const clicks = clicksRes.data ?? [];
    const countClicks = (loc: string) =>
      clicks.filter((c: any) => c.cta_location === loc).length;

    return {
      days: data.days,
      signups: leads.length,
      uniqueLeads: emails.length,
      marketingOptIns: leads.filter((l) => l.marketingConsent).length,
      emailsQueued: leads.filter((l) => l.sendStatus === "queued").length,
      emailsDelivered: delivered,
      emailFailures: leads.filter((l) => l.sendStatus?.startsWith("failed")).length,
      downloadClicks: countClicks("creator_starter_pack_download_clicked"),
      applicationClicks: countClicks("creator_application_clicked"),
      applicationsSubmitted: leads.filter((l) => l.applicationId).length,
      approvedCreators: leads.filter((l) => l.convertedAt).length,
      topSources: tally(leads.map((l) => l.utmSource)),
      topCampaigns: tally(leads.map((l) => l.utmCampaign)),
      recentFailures: leads.filter((l) => l.sendStatus?.startsWith("failed")).slice(0, 25),
      leads: leads.slice(0, 200),
    };
  });
