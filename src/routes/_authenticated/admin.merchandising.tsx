import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { getMerchandisingReport } from "@/lib/merchandising.functions";

export const Route = createFileRoute("/_authenticated/admin/merchandising")({
  component: MerchandisingDashboard,
  head: () => ({
    meta: [
      { title: "AOV & Bundles Analytics · AurumVault Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const money = (c: number | null) => (c === null ? "—" : `$${(c / 100).toFixed(2)}`);
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

function MerchandisingDashboard() {
  const reportFn = useServerFn(getMerchandisingReport);
  const [days, setDays] = useState(30);
  const q = useQuery({
    queryKey: ["admin", "merchandising", days],
    queryFn: () => reportFn({ data: { days } }),
  });
  const r = q.data;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link
        to="/admin/bundles"
        className="inline-flex items-center gap-2 text-sm text-black/55 hover:text-navy"
      >
        <ArrowLeft size={16} /> Bundles
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Average order value &amp; attach rates</h1>
          <p className="mt-1 text-sm text-black/55">
            Every figure is counted from stored orders and merchandising events — nothing is
            estimated.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-full border border-black/15 px-3 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            type="button"
            onClick={() => void q.refetch()}
            className="inline-flex items-center gap-2 rounded-full border border-black/15 px-4 py-2 text-sm font-semibold text-navy"
          >
            <RefreshCw size={14} className={q.isFetching ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {q.isLoading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-black/50">
          <Loader2 size={14} className="animate-spin" /> Loading report…
        </div>
      )}

      {r && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Average order value"
              value={money(r.current.aovCents)}
              delta={r.aovChangePct}
              sub={`vs ${money(r.previous.aovCents)} prior period`}
            />
            <Stat
              label="Orders"
              value={String(r.current.orders)}
              sub={`${r.current.itemsPerOrder ?? "—"} items per order`}
            />
            <Stat
              label="Bundle attach rate"
              value={pct(r.current.bundleAttachRatePct)}
              delta={r.attachChangePct}
              sub={`${r.current.bundleOrders} bundle orders`}
            />
            <Stat
              label="Order bump attach rate"
              value={pct(r.current.bumpAttachRatePct)}
              sub={`${money(r.current.revenueCents)} total revenue`}
            />
          </div>

          {r.weakestStep && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <TrendingDown size={16} /> Weakest merchandising step:{" "}
              <strong>{r.weakestStep}</strong>
            </div>
          )}

          <h2 className="mt-8 text-lg font-bold text-navy">Bundle performance</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-black/10 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-black/[0.03] text-left text-xs uppercase text-black/55">
                <tr>
                  <th className="p-3">Bundle</th>
                  <th className="p-3">Views</th>
                  <th className="p-3">Clicks</th>
                  <th className="p-3">Add to cart</th>
                  <th className="p-3">Orders</th>
                  <th className="p-3">Revenue</th>
                  <th className="p-3">View → order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {r.bundles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-black/55">
                      No bundles yet.{" "}
                      <Link to="/admin/bundles" className="text-navy underline">
                        Create one
                      </Link>
                      .
                    </td>
                  </tr>
                )}
                {r.bundles.map((b) => (
                  <tr key={b.id}>
                    <td className="p-3 font-semibold text-navy">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers size={13} className="text-gold-ink" /> {b.name}
                      </span>
                    </td>
                    <td className="p-3">{b.impressions}</td>
                    <td className="p-3">{b.clicks}</td>
                    <td className="p-3">{b.addToCart}</td>
                    <td className="p-3">{b.orders}</td>
                    <td className="p-3">{money(b.revenueCents)}</td>
                    <td className="p-3">{pct(b.conversionPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-8 text-lg font-bold text-navy">Surface engagement</h2>
          <div className="mt-3 space-y-2">
            {r.surfaces.length === 0 && (
              <p className="text-sm text-black/55">No merchandising events recorded yet.</p>
            )}
            {r.surfaces.map((s) => (
              <div
                key={s.surface}
                className="flex items-center justify-between rounded-xl border border-black/10 bg-white p-3 text-sm"
              >
                <span className="font-semibold text-navy">{s.surface}</span>
                <span className="text-black/55">
                  {s.impressions} views · {s.clicks} clicks · CTR {pct(s.ctrPct)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-black/50">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-navy">{value}</span>
        {delta !== undefined && delta !== null && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              delta >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-xs text-black/50">{sub}</div>}
    </div>
  );
}
