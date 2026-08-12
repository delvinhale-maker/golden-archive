/** Pure aggregation helpers for the creator-lead funnel dashboard. */

export type ClickRow = {
  cta_location: string;
  page_path: string | null;
  session_id: string;
  created_at: string;
};

export type LeadRow = {
  cta_source: string | null;
  product_type: string;
  follower_count: number;
  created_at: string;
};

export type ConversionRow = {
  key: string;
  clicks: number;
  uniqueVisitors: number;
  leads: number;
  conversionPct: number;
};

export type BreakdownRow = {
  key: string;
  leads: number;
  sharePct: number;
};

export type LeadAnalytics = {
  days: number;
  totals: { clicks: number; uniqueVisitors: number; leads: number; conversionPct: number };
  byCtaLocation: ConversionRow[];
  byPagePath: ConversionRow[];
  byProductType: BreakdownRow[];
  byFollowerBand: BreakdownRow[];
};

/** Follower buckets used for grouping lead quality. */
export const FOLLOWER_BANDS: { label: string; min: number; max: number }[] = [
  { label: "0 – 1k", min: 0, max: 1_000 },
  { label: "1k – 5k", min: 1_000, max: 5_000 },
  { label: "5k – 25k", min: 5_000, max: 25_000 },
  { label: "25k – 100k", min: 25_000, max: 100_000 },
  { label: "100k+", min: 100_000, max: Infinity },
];

export function followerBand(count: number): string {
  const band = FOLLOWER_BANDS.find((b) => count >= b.min && count < b.max);
  return band?.label ?? FOLLOWER_BANDS[FOLLOWER_BANDS.length - 1].label;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function buildLeadAnalytics(
  clicks: ClickRow[],
  leads: LeadRow[],
  days: number,
): LeadAnalytics {
  const clickCount = new Map<string, number>();
  const clickSessions = new Map<string, Set<string>>();
  const pathCount = new Map<string, number>();
  const pathSessions = new Map<string, Set<string>>();

  for (const c of clicks) {
    const loc = c.cta_location || "(unknown)";
    clickCount.set(loc, (clickCount.get(loc) ?? 0) + 1);
    if (!clickSessions.has(loc)) clickSessions.set(loc, new Set());
    clickSessions.get(loc)!.add(c.session_id);

    const path = c.page_path || "(unknown)";
    pathCount.set(path, (pathCount.get(path) ?? 0) + 1);
    if (!pathSessions.has(path)) pathSessions.set(path, new Set());
    pathSessions.get(path)!.add(c.session_id);
  }

  // Leads carry the CTA they came from, so they map straight onto cta_location.
  const leadsByCta = new Map<string, number>();
  const leadsByProduct = new Map<string, number>();
  const leadsByBand = new Map<string, number>();
  for (const l of leads) {
    const src = l.cta_source || "(unknown)";
    leadsByCta.set(src, (leadsByCta.get(src) ?? 0) + 1);
    const type = l.product_type || "(unspecified)";
    leadsByProduct.set(type, (leadsByProduct.get(type) ?? 0) + 1);
    const band = followerBand(Number(l.follower_count) || 0);
    leadsByBand.set(band, (leadsByBand.get(band) ?? 0) + 1);
  }

  const ctaKeys = new Set<string>([...clickCount.keys(), ...leadsByCta.keys()]);
  const byCtaLocation: ConversionRow[] = [...ctaKeys]
    .map((key) => {
      const c = clickCount.get(key) ?? 0;
      const l = leadsByCta.get(key) ?? 0;
      return {
        key,
        clicks: c,
        uniqueVisitors: clickSessions.get(key)?.size ?? 0,
        leads: l,
        conversionPct: pct(l, c),
      };
    })
    .sort((a, b) => b.clicks - a.clicks || b.leads - a.leads);

  const totalLeads = leads.length;
  const totalClicks = clicks.length;
  const allSessions = new Set(clicks.map((c) => c.session_id));

  // Page-path conversion attributes leads proportionally to the page's share of
  // clicks, since lead rows record the CTA, not the page they were on.
  const byPagePath: ConversionRow[] = [...pathCount.keys()]
    .map((key) => {
      const c = pathCount.get(key) ?? 0;
      const attributed = totalClicks > 0 ? Math.round((c / totalClicks) * totalLeads) : 0;
      return {
        key,
        clicks: c,
        uniqueVisitors: pathSessions.get(key)?.size ?? 0,
        leads: attributed,
        conversionPct: pct(attributed, c),
      };
    })
    .sort((a, b) => b.clicks - a.clicks);

  const byProductType: BreakdownRow[] = [...leadsByProduct.entries()]
    .map(([key, leadsN]) => ({ key, leads: leadsN, sharePct: pct(leadsN, totalLeads) }))
    .sort((a, b) => b.leads - a.leads);

  const byFollowerBand: BreakdownRow[] = FOLLOWER_BANDS.map((b) => ({
    key: b.label,
    leads: leadsByBand.get(b.label) ?? 0,
    sharePct: pct(leadsByBand.get(b.label) ?? 0, totalLeads),
  }));

  return {
    days,
    totals: {
      clicks: totalClicks,
      uniqueVisitors: allSessions.size,
      leads: totalLeads,
      conversionPct: pct(totalLeads, totalClicks),
    },
    byCtaLocation,
    byPagePath,
    byProductType,
    byFollowerBand,
  };
}
