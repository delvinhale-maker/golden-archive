import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useTransition } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BarChart3, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getLeadAnalytics } from "@/lib/lead-analytics.functions";
import type {
  BreakdownRow,
  ConversionRow,
  LeadAnalytics,
  SegmentRow,
} from "@/lib/lead-analytics";

export const Route = createFileRoute("/_authenticated/admin/lead-analytics")({
  component: LeadAnalyticsPage,
  head: () => ({
    meta: [
      { title: "Lead Analytics · AurumVault Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const RANGES = [7, 30, 90] as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-caps text-black/50">{label}</div>
      <div className="mt-1 text-2xl font-bold text-navy">{value}</div>
    </div>
  );
}

function ConversionTable({ title, rows, firstCol }: { title: string; rows: ConversionRow[]; firstCol: string }) {
  return (
    <section className="rounded-xl border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold text-navy">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-black/50">No data in this range yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-caps text-black/50">
                <th className="py-2 pr-3 font-semibold">{firstCol}</th>
                <th className="py-2 pr-3 font-semibold">Clicks</th>
                <th className="py-2 pr-3 font-semibold">Visitors</th>
                <th className="py-2 pr-3 font-semibold">Leads</th>
                <th className="py-2 pr-3 font-semibold">Confirmed</th>
                <th className="py-2 pr-3 font-semibold">Click→lead</th>
                <th className="py-2 pr-3 font-semibold">Lead→conf.</th>
                <th className="py-2 pr-3 font-semibold">Click drop-off</th>
                <th className="py-2 font-semibold">Lead drop-off</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-black/5">
                  <td className="py-2 pr-3 font-medium text-navy break-all">{r.key}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.clicks}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.uniqueVisitors}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.leads}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.confirmed}</td>
                  <td className="py-2 pr-3 tabular-nums font-semibold">{r.conversionPct}%</td>
                  <td className="py-2 pr-3 tabular-nums font-semibold">{r.confirmRatePct}%</td>
                  <td className="py-2 pr-3 tabular-nums text-red-600">{r.clickDropOffPct}%</td>
                  <td className="py-2 tabular-nums text-red-600">{r.leadDropOffPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BreakdownList({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.leads));
  return (
    <section className="rounded-xl border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold text-navy">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-black/50">No leads in this range yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-navy">{r.key}</span>
                <span className="tabular-nums text-black/60">
                  {r.leads} leads · {r.confirmed} conf. ·{" "}
                  <span className="text-red-600">{r.leadDropOffPct}% drop</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/5">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${(r.leads / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SegmentTable({
  title,
  segmentCol,
  keyCol,
  rows,
}: {
  title: string;
  segmentCol: string;
  keyCol: string;
  rows: SegmentRow[];
}) {
  return (
    <section className="rounded-xl border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold text-navy">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-black/50">No leads in this range yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-caps text-black/50">
                <th className="py-2 pr-3 font-semibold">{segmentCol}</th>
                <th className="py-2 pr-3 font-semibold">{keyCol}</th>
                <th className="py-2 pr-3 font-semibold">Leads</th>
                <th className="py-2 pr-3 font-semibold">Confirmed</th>
                <th className="py-2 pr-3 font-semibold">Lead→conf.</th>
                <th className="py-2 font-semibold">Drop-off</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.segment}|${r.key}`} className="border-t border-black/5">
                  <td className="py-2 pr-3 font-medium text-navy break-all">{r.segment}</td>
                  <td className="py-2 pr-3 text-navy">{r.key}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.leads}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.confirmed}</td>
                  <td className="py-2 pr-3 tabular-nums font-semibold">{r.confirmRatePct}%</td>
                  <td className="py-2 tabular-nums text-red-600">{r.leadDropOffPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FunnelBar({ totals }: { totals: LeadAnalytics["totals"] }) {
  const stages = [
    { label: "CTA clicks", value: totals.clicks, drop: totals.clickDropOffPct, dropLabel: "lost before lead" },
    { label: "Leads captured", value: totals.leads, drop: totals.leadDropOffPct, dropLabel: "lost before confirm" },
    { label: "Confirmed", value: totals.confirmed, drop: null, dropLabel: "" },
  ];
  const max = Math.max(1, totals.clicks);
  return (
    <section className="rounded-xl border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold text-navy">Click → lead → confirmed funnel</h2>
      <ul className="mt-3 space-y-3">
        {stages.map((s) => (
          <li key={s.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-navy">{s.label}</span>
              <span className="tabular-nums text-black/60">{s.value}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/5">
              <div className="h-full rounded-full bg-gold" style={{ width: `${(s.value / max) * 100}%` }} />
            </div>
            {s.drop !== null && (
              <p className="mt-1 text-xs text-red-600">
                {s.drop}% {s.dropLabel}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-black/50">
        Confirmed = the Starter Kit email was successfully sent to that lead.
      </p>
    </section>
  );
}

function LeadAnalyticsPage() {
  const fetchAnalytics = useServerFn(getLeadAnalytics);
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<LeadAnalytics | null>(null);
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      try {
        setData(await fetchAnalytics({ data: { days } }));
      } catch {
        toast.error("Failed to load lead analytics");
      }
    });
  };

  useEffect(load, [days]);

  return (
    <div className="min-h-screen bg-[#fafaf7]">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 md:px-8">
          <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
            <ArrowLeft size={14} /> Admin
          </Link>
          <span className="ml-auto inline-flex items-center gap-2 text-sm font-semibold">
            <BarChart3 size={16} /> Lead analytics
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                days === r
                  ? "border-navy bg-navy text-white"
                  : "border-black/15 bg-white text-navy hover:bg-black/5"
              }`}
            >
              Last {r} days
            </button>
          ))}
          <button
            type="button"
            onClick={load}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-black/5 disabled:opacity-60"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="CTA clicks" value={String(data?.totals.clicks ?? 0)} />
          <Stat label="Unique visitors" value={String(data?.totals.uniqueVisitors ?? 0)} />
          <Stat label="Leads captured" value={String(data?.totals.leads ?? 0)} />
          <Stat label="Clicks → leads" value={`${data?.totals.conversionPct ?? 0}%`} />
          <Stat label="Confirmed leads" value={String(data?.totals.confirmed ?? 0)} />
          <Stat label="Leads → confirmed" value={`${data?.totals.confirmRatePct ?? 0}%`} />
          <Stat label="Clicks → confirmed" value={`${data?.totals.endToEndPct ?? 0}%`} />
          <Stat label="Lead drop-off" value={`${data?.totals.leadDropOffPct ?? 0}%`} />
        </div>

        {data && <FunnelBar totals={data.totals} />}

        <ConversionTable
          title="Conversion by CTA location"
          firstCol="cta_location"
          rows={data?.byCtaLocation ?? []}
        />
        <ConversionTable
          title="Conversion by page path"
          firstCol="page_path"
          rows={data?.byPagePath ?? []}
        />
        <p className="text-xs text-black/50">
          Page-path leads are attributed proportionally to each page's share of clicks, because lead
          records store the CTA they came from rather than the page.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <BreakdownList title="Leads by product type" rows={data?.byProductType ?? []} />
          <BreakdownList title="Leads by follower count" rows={data?.byFollowerBand ?? []} />
        </div>

        <SegmentTable
          title="Drop-off by CTA location × product type"
          segmentCol="cta_location"
          keyCol="product_type"
          rows={data?.ctaByProductType ?? []}
        />
        <SegmentTable
          title="Drop-off by CTA location × follower band"
          segmentCol="cta_location"
          keyCol="follower band"
          rows={data?.ctaByFollowerBand ?? []}
        />
        <SegmentTable
          title="Drop-off by page path × product type"
          segmentCol="page_path"
          keyCol="product_type"
          rows={data?.pageByProductType ?? []}
        />
        <SegmentTable
          title="Drop-off by page path × follower band"
          segmentCol="page_path"
          keyCol="follower band"
          rows={data?.pageByFollowerBand ?? []}
        />
      </main>
    </div>
  );
}
