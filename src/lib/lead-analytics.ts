/** Pure aggregation helpers for the creator-lead funnel dashboard. */

export type ClickRow = {
  cta_location: string;
  page_path: string | null;
  session_id: string;
  created_at: string;
};

export type LeadRow = {
  email: string;
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
  confirmed: number;
  /** clicks -> leads */
  conversionPct: number;
  /** leads -> confirmed */
  confirmRatePct: number;
  /** clicks -> confirmed */
  endToEndPct: number;
  /** % of clicks that never became a lead */
  clickDropOffPct: number;
  /** % of leads that never confirmed */
  leadDropOffPct: number;
};

export type BreakdownRow = {
  key: string;
  leads: number;
  confirmed: number;
  confirmRatePct: number;
  leadDropOffPct: number;
  sharePct: number;
};

/** One funnel segment: a cta_location/page_path crossed with product type or band. */
export type SegmentRow = {
  segment: string;
  key: string;
  leads: number;
  confirmed: number;
  confirmRatePct: number;
  leadDropOffPct: number;
};

export type LeadAnalytics = {
  days: number;
  totals: {
    clicks: number;
    uniqueVisitors: number;
    leads: number;
    confirmed: number;
    conversionPct: number;
    confirmRatePct: number;
    endToEndPct: number;
    clickDropOffPct: number;
    leadDropOffPct: number;
  };
  byCtaLocation: ConversionRow[];
  byPagePath: ConversionRow[];
  byProductType: BreakdownRow[];
  byFollowerBand: BreakdownRow[];
  /** cta_location x product_type / follower band drop-off */
  ctaByProductType: SegmentRow[];
  ctaByFollowerBand: SegmentRow[];
  /** page_path x product_type / follower band drop-off (proportional attribution) */
  pageByProductType: SegmentRow[];
  pageByFollowerBand: SegmentRow[];
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
  confirmedEmails: string[] = [],
): LeadAnalytics {
  const confirmedSet = new Set(confirmedEmails.map((e) => e.trim().toLowerCase()));
  const isConfirmed = (l: LeadRow) => confirmedSet.has((l.email || "").trim().toLowerCase());
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
  const confirmedByCta = new Map<string, number>();
  const leadsByProduct = new Map<string, number>();
  const confirmedByProduct = new Map<string, number>();
  const leadsByBand = new Map<string, number>();
  const confirmedByBand = new Map<string, number>();
  // "cta::segment" -> counts, for the crossed drop-off tables.
  const crossLeads = new Map<string, number>();
  const crossConfirmed = new Map<string, number>();
  let totalConfirmed = 0;

  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  for (const l of leads) {
    const ok = isConfirmed(l);
    if (ok) totalConfirmed += 1;
    const src = l.cta_source || "(unknown)";
    const type = l.product_type || "(unspecified)";
    const band = followerBand(Number(l.follower_count) || 0);

    bump(leadsByCta, src);
    bump(leadsByProduct, type);
    bump(leadsByBand, band);
    bump(crossLeads, `${src}\u0000type\u0000${type}`);
    bump(crossLeads, `${src}\u0000band\u0000${band}`);
    if (ok) {
      bump(confirmedByCta, src);
      bump(confirmedByProduct, type);
      bump(confirmedByBand, band);
      bump(crossConfirmed, `${src}\u0000type\u0000${type}`);
      bump(crossConfirmed, `${src}\u0000band\u0000${band}`);
    }
  }

  const ctaKeys = new Set<string>([...clickCount.keys(), ...leadsByCta.keys()]);
  const byCtaLocation: ConversionRow[] = [...ctaKeys]
    .map((key) => {
      const c = clickCount.get(key) ?? 0;
      const l = leadsByCta.get(key) ?? 0;
      const conf = confirmedByCta.get(key) ?? 0;
      return {
        key,
        clicks: c,
        uniqueVisitors: clickSessions.get(key)?.size ?? 0,
        leads: l,
        confirmed: conf,
        conversionPct: pct(l, c),
        confirmRatePct: pct(conf, l),
        endToEndPct: pct(conf, c),
        clickDropOffPct: pct(Math.max(c - l, 0), c),
        leadDropOffPct: pct(Math.max(l - conf, 0), l),
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
      const share = totalClicks > 0 ? c / totalClicks : 0;
      const attributed = Math.round(share * totalLeads);
      const attributedConfirmed = Math.round(share * totalConfirmed);
      return {
        key,
        clicks: c,
        uniqueVisitors: pathSessions.get(key)?.size ?? 0,
        leads: attributed,
        confirmed: attributedConfirmed,
        conversionPct: pct(attributed, c),
        confirmRatePct: pct(attributedConfirmed, attributed),
        endToEndPct: pct(attributedConfirmed, c),
        clickDropOffPct: pct(Math.max(c - attributed, 0), c),
        leadDropOffPct: pct(Math.max(attributed - attributedConfirmed, 0), attributed),
      };
    })
    .sort((a, b) => b.clicks - a.clicks);

  const breakdown = (key: string, leadsN: number, conf: number): BreakdownRow => ({
    key,
    leads: leadsN,
    confirmed: conf,
    confirmRatePct: pct(conf, leadsN),
    leadDropOffPct: pct(Math.max(leadsN - conf, 0), leadsN),
    sharePct: pct(leadsN, totalLeads),
  });

  const byProductType: BreakdownRow[] = [...leadsByProduct.entries()]
    .map(([key, leadsN]) => breakdown(key, leadsN, confirmedByProduct.get(key) ?? 0))
    .sort((a, b) => b.leads - a.leads);

  const byFollowerBand: BreakdownRow[] = FOLLOWER_BANDS.map((b) =>
    breakdown(b.label, leadsByBand.get(b.label) ?? 0, confirmedByBand.get(b.label) ?? 0),
  );

  // Crossed segments: cta_location x (product type | follower band).
  const crossRows = (kind: "type" | "band"): SegmentRow[] =>
    [...crossLeads.entries()]
      .map(([composite, leadsN]) => {
        const [segment, k, key] = composite.split("\u0000");
        if (k !== kind) return null;
        const conf = crossConfirmed.get(composite) ?? 0;
        return {
          segment,
          key,
          leads: leadsN,
          confirmed: conf,
          confirmRatePct: pct(conf, leadsN),
          leadDropOffPct: pct(Math.max(leadsN - conf, 0), leadsN),
        } satisfies SegmentRow;
      })
      .filter((r): r is SegmentRow => r !== null)
      .sort((a, b) => b.leads - a.leads || a.segment.localeCompare(b.segment));

  const ctaByProductType = crossRows("type");
  const ctaByFollowerBand = crossRows("band");

  // Page paths don't appear on lead rows, so each path inherits the crossed
  // segment mix proportionally to its share of clicks.
  const pageCross = (rows: SegmentRow[]): SegmentRow[] =>
    byPagePath.flatMap((p) => {
      const share = totalLeads > 0 ? p.leads / totalLeads : 0;
      if (share <= 0) return [];
      const seen = new Map<string, { leads: number; confirmed: number }>();
      for (const r of rows) {
        const prev = seen.get(r.key) ?? { leads: 0, confirmed: 0 };
        seen.set(r.key, { leads: prev.leads + r.leads, confirmed: prev.confirmed + r.confirmed });
      }
      return [...seen.entries()]
        .map(([key, v]) => {
          const leadsN = Math.round(v.leads * share);
          const conf = Math.round(v.confirmed * share);
          return {
            segment: p.key,
            key,
            leads: leadsN,
            confirmed: conf,
            confirmRatePct: pct(conf, leadsN),
            leadDropOffPct: pct(Math.max(leadsN - conf, 0), leadsN),
          } satisfies SegmentRow;
        })
        .filter((r) => r.leads > 0);
    });

  const pageByProductType = pageCross(ctaByProductType);
  const pageByFollowerBand = pageCross(ctaByFollowerBand);

  return {
    days,
    totals: {
      clicks: totalClicks,
      uniqueVisitors: allSessions.size,
      leads: totalLeads,
      confirmed: totalConfirmed,
      conversionPct: pct(totalLeads, totalClicks),
      confirmRatePct: pct(totalConfirmed, totalLeads),
      endToEndPct: pct(totalConfirmed, totalClicks),
      clickDropOffPct: pct(Math.max(totalClicks - totalLeads, 0), totalClicks),
      leadDropOffPct: pct(Math.max(totalLeads - totalConfirmed, 0), totalLeads),
    },
    byCtaLocation,
    byPagePath,
    byProductType,
    byFollowerBand,
    ctaByProductType,
    ctaByFollowerBand,
    pageByProductType,
    pageByFollowerBand,
  };
}
