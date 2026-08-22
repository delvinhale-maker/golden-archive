/**
 * Founding 100 conversion funnel — every stage is derived from real records
 * (click events, leads, applications, cohort rows, products, order items).
 * Nothing here is hardcoded or estimated. Milestone timestamps discovered while
 * measuring are written back to `creator_activation` so activation emails and
 * later reports share one truth.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { FOUNDING_CAMPAIGN, FOUNDING_COHORT_SIZE, FOUNDING_EVENTS } from "@/lib/founding";
import { STARTER_PACK_EVENTS } from "@/lib/starter-pack";

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  /** Conversion from the previous stage, 0–100, null when the previous stage is empty. */
  fromPrevPct: number | null;
  /** Conversion from the first stage, 0–100, null when visitors is empty. */
  fromTopPct: number | null;
};

export type FoundingFunnel = {
  stages: FunnelStage[];
  cohortSize: number;
  generatedAt: string;
  activationSynced: number;
};

const CAMPAIGN_MATCH = FOUNDING_CAMPAIGN;

function pct(n: number, d: number): number | null {
  if (!d) return null;
  return Math.round((n / d) * 1000) / 10;
}

export async function computeFoundingFunnel(supabase: SupabaseClient): Promise<FoundingFunnel> {
  const [clicksRes, leadsRes, appsRes, cohortRes] = await Promise.all([
    supabase
      .from("cta_click_events")
      .select("session_id, cta_location")
      .in("cta_location", [
        FOUNDING_EVENTS.viewed,
        FOUNDING_EVENTS.applyClicked,
        FOUNDING_EVENTS.starterPackClicked,
        FOUNDING_EVENTS.applicationSubmitted,
        STARTER_PACK_EVENTS.submitted,
      ])
      .limit(50000),
    supabase
      .from("creator_leads")
      .select("id, email, starter_pack_requested_at, utm_campaign, cta_source, landing_page")
      .not("starter_pack_requested_at", "is", null)
      .limit(20000),
    supabase
      .from("seller_applications")
      .select("id, user_id, status, campaign")
      .eq("campaign", CAMPAIGN_MATCH)
      .limit(5000),
    supabase.from("founding_creators").select("user_id, accepted_at").limit(1000),
  ]);

  const clicks = (clicksRes.data ?? []) as { session_id: string; cta_location: string }[];
  const sessionsFor = (event: string) =>
    new Set(clicks.filter((c) => c.cta_location === event).map((c) => c.session_id)).size;

  // Unique campaign visitors, not raw page views.
  const visitors = sessionsFor(FOUNDING_EVENTS.viewed);

  // Starter pack leads attributable to the founding campaign; falls back to the
  // campaign-tagged UTM/CTA/landing fields written at capture time.
  const leads = (leadsRes.data ?? []) as {
    id: string;
    utm_campaign: string | null;
    cta_source: string | null;
    landing_page: string | null;
  }[];
  const campaignLeads = leads.filter((l) =>
    [l.utm_campaign, l.cta_source, l.landing_page].some(
      (v) => typeof v === "string" && v.includes("founding"),
    ),
  ).length;
  const starterPackLeads = campaignLeads || sessionsFor(STARTER_PACK_EVENTS.submitted);

  const apps = (appsRes.data ?? []) as { id: string; user_id: string; status: string }[];
  const applications = apps.length;

  const cohort = (cohortRes.data ?? []) as { user_id: string; accepted_at: string }[];
  const approvals = cohort.length;
  const cohortIds = cohort.map((c) => c.user_id);

  let firstProduct = 0;
  let firstSale = 0;
  let activationSynced = 0;

  if (cohortIds.length) {
    const [productsRes, salesRes] = await Promise.all([
      supabase
        .from("marketplace_products")
        .select("seller_id, created_at, status, published, approved_at")
        .in("seller_id", cohortIds)
        .limit(20000),
      supabase
        .from("order_items")
        .select("seller_id, created_at")
        .in("seller_id", cohortIds)
        .limit(20000),
    ]);

    const products = (productsRes.data ?? []) as {
      seller_id: string;
      created_at: string;
      status: string;
      published: boolean;
      approved_at: string | null;
    }[];
    const sales = (salesRes.data ?? []) as { seller_id: string; created_at: string }[];

    const earliest = new Map<string, Record<string, string>>();
    const keep = (userId: string, field: string, at: string | null) => {
      if (!at) return;
      const row = earliest.get(userId) ?? {};
      if (!row[field] || at < row[field]!) row[field] = at;
      earliest.set(userId, row);
    };

    for (const p of products) {
      keep(p.seller_id, "first_product_started_at", p.created_at);
      if (p.status !== "draft") keep(p.seller_id, "first_product_submitted_at", p.created_at);
      if (p.status === "approved") keep(p.seller_id, "first_product_approved_at", p.approved_at ?? p.created_at);
      if (p.published) keep(p.seller_id, "first_product_published_at", p.approved_at ?? p.created_at);
    }
    for (const s of sales) keep(s.seller_id, "first_sale_at", s.created_at);

    firstProduct = new Set(products.filter((p) => p.published).map((p) => p.seller_id)).size;
    firstSale = new Set(sales.map((s) => s.seller_id)).size;

    // Persist derived milestones so nudges and reports read one source.
    const rows = [...earliest.entries()].map(([user_id, fields]) => ({ user_id, ...fields }));
    if (rows.length) {
      const { error } = await supabase
        .from("creator_activation")
        .upsert(rows, { onConflict: "user_id" });
      if (!error) activationSynced = rows.length;
    }
  }

  const ordered: { key: string; label: string; count: number }[] = [
    { key: "visitors", label: "Campaign visitors", count: visitors },
    { key: "starter_pack", label: "Starter Pack leads", count: starterPackLeads },
    { key: "applications", label: "Applications", count: applications },
    { key: "approvals", label: "Accepted creators", count: approvals },
    { key: "first_product", label: "First product live", count: firstProduct },
    { key: "first_sale", label: "First sale", count: firstSale },
  ];

  const top = ordered[0]!.count;
  const stages: FunnelStage[] = ordered.map((s, i) => ({
    ...s,
    fromPrevPct: i === 0 ? null : pct(s.count, ordered[i - 1]!.count),
    fromTopPct: i === 0 ? null : pct(s.count, top),
  }));

  return {
    stages,
    cohortSize: FOUNDING_COHORT_SIZE,
    generatedAt: new Date().toISOString(),
    activationSynced,
  };
}
