import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, MousePointerClick, Share2, ShoppingBag } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getMyStorefrontAnalytics } from "@/lib/storefront.functions";
import { conversionRate } from "@/lib/storefront";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  head: () => ({
    meta: [
      { title: "Storefront Analytics — AurumVault" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StorefrontAnalyticsPage,
});

const RANGES = [7, 30, 90] as const;
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function StorefrontAnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const fetchAnalytics = useServerFn(getMyStorefrontAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["storefront-analytics", days],
    queryFn: () => fetchAnalytics({ data: { days } }),
  });

  const maxGross = Math.max(1, ...(data?.topProducts ?? []).map((p) => p.grossCents));
  const maxViews = Math.max(1, ...(data?.trafficSources ?? []).map((s) => s.views));

  return (
    <PublisherShell accent={ACCENTS.bookshelf}>
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy">
        <ArrowLeft size={14} /> Back
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy">Storefront analytics</h1>
          <p className="mt-1 text-sm text-mute">
            Your traffic, conversions, and earnings. Only you can see these numbers.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-ink/15 bg-white p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                days === r ? "bg-navy text-white" : "text-mute hover:text-navy"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <p className="mt-8 text-mute">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={<Eye size={15} />} label="Storefront views" value={data.storefrontViews} />
            <Stat
              icon={<MousePointerClick size={15} />}
              label="Product clicks"
              value={data.productClicks}
              hint={`${conversionRate(data.productClicks, data.storefrontViews)}% of views`}
            />
            <Stat icon={<Share2 size={15} />} label="Shares & QR scans" value={data.shares} />
            <Stat
              icon={<ShoppingBag size={15} />}
              label="Orders"
              value={data.orders}
              hint={`${conversionRate(data.orders, data.storefrontViews)}% of views`}
            />
          </div>

          <section className="mt-4 grid gap-3 md:grid-cols-3">
            <MoneyCard
              label="Gross marketplace sales"
              value={money(data.grossCents)}
              note="What buyers paid in total"
            />
            <MoneyCard
              label="Your earnings"
              value={money(data.creatorEarningsCents)}
              note="Your 85% share"
              emphasis
            />
            <MoneyCard
              label="AurumVault fee"
              value={money(data.platformFeeCents)}
              note="Platform 15%"
            />
          </section>

          <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-xl text-navy">Top products</h2>
            {data.topProducts.length === 0 ? (
              <p className="mt-2 text-sm text-mute">No sales in this window yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.topProducts.map((p) => (
                  <li key={p.productId}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm text-navy">{p.title}</span>
                      <span className="shrink-0 text-xs text-mute">
                        {p.units} sold · {money(p.grossCents)} gross · {money(p.creatorEarningsCents)} yours
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-navy/5">
                      <div
                        className="h-2 rounded-full bg-gold"
                        style={{ width: `${Math.max(4, (p.grossCents / maxGross) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-xl text-navy">Where your visitors come from</h2>
            {data.trafficSources.length === 0 ? (
              <p className="mt-2 text-sm text-mute">
                No storefront visits recorded yet. Share your link to start tracking.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.trafficSources.map((s) => (
                  <li key={s.source}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm capitalize text-navy">{s.source}</span>
                      <span className="shrink-0 text-xs text-mute">{s.views} views</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-navy/5">
                      <div
                        className="h-2 rounded-full bg-accent-dusty"
                        style={{ width: `${Math.max(4, (s.views / maxViews) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </PublisherShell>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4">
      <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-caps text-mute">
        {icon} {label}
      </p>
      <p className="mt-1.5 font-display text-2xl text-navy">{value.toLocaleString()}</p>
      {hint ? <p className="text-xs text-mute">{hint}</p> : null}
    </div>
  );
}

function MoneyCard({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        emphasis ? "border-gold/40 bg-gold/5" : "border-ink/10 bg-white"
      }`}
    >
      <p className="text-xs uppercase tracking-caps text-mute">{label}</p>
      <p className="mt-1.5 font-display text-2xl text-navy">{value}</p>
      <p className="text-xs text-mute">{note}</p>
    </div>
  );
}
