import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RefreshCw, TrendingDown } from "lucide-react";
import { getFoundingFunnel } from "@/lib/founding.functions";
import { FOUNDING_COHORT_SIZE } from "@/lib/founding";

export const Route = createFileRoute("/_authenticated/admin/founding-analytics")({
  component: FoundingAnalytics,
  head: () => ({
    meta: [
      { title: "Founding 100 Analytics · AurumVault Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STAGE_NOTES: Record<string, string> = {
  visitors: "Unique sessions that opened the Founding 100 campaign page.",
  starter_pack: "Starter Pack leads attributed to the founding campaign.",
  applications: "Creator applications carrying founding campaign attribution.",
  approvals: "Applications accepted into the cohort with a founding number.",
  first_product: "Accepted creators with at least one published product.",
  first_sale: "Accepted creators with at least one recorded sale.",
};

function FoundingAnalytics() {
  const fetchFunnel = useServerFn(getFoundingFunnel);
  const funnel = useQuery({
    queryKey: ["founding-funnel", "dashboard"],
    queryFn: () => fetchFunnel(),
  });

  const data = funnel.data;
  const stages = data?.stages ?? [];
  const top = stages[0]?.count ?? 0;
  const bottom = stages[stages.length - 1]?.count ?? 0;
  const biggestDrop = stages
    .slice(1)
    .filter((s) => s.fromPrevPct !== null)
    .sort((a, b) => (a.fromPrevPct ?? 100) - (b.fromPrevPct ?? 100))[0];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link
        to="/admin/founding-100"
        className="inline-flex items-center gap-2 text-sm text-black/55 hover:text-navy"
      >
        <ArrowLeft size={16} /> Founding 100 command center
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Founding 100 conversion analytics</h1>
          <p className="mt-1 text-sm text-black/55">
            Visitor → Starter Pack → application → approval → first product → first sale. Every
            number is counted from stored records, never estimated.
          </p>
        </div>
        <button
          type="button"
          onClick={() => funnel.refetch()}
          disabled={funnel.isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-navy disabled:opacity-50"
        >
          <RefreshCw size={15} className={funnel.isFetching ? "animate-spin" : undefined} />
          Refresh
        </button>
      </div>

      {funnel.isLoading ? (
        <p className="mt-10 flex items-center gap-2 text-sm text-black/50">
          <Loader2 size={16} className="animate-spin" /> Measuring the funnel…
        </p>
      ) : funnel.isError ? (
        <p className="mt-10 text-sm text-red-600">
          Could not load funnel analytics. Refresh to try again.
        </p>
      ) : !data || stages.length === 0 ? (
        <p className="mt-10 text-sm text-black/50">No funnel activity recorded yet.</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Summary label="Campaign visitors" value={String(top)} />
            <Summary
              label="End-to-end conversion"
              value={top > 0 ? `${Math.round((bottom / top) * 1000) / 10}%` : "—"}
              hint="Visitor → first sale"
            />
            <Summary
              label="Cohort filled"
              value={`${stages.find((s) => s.key === "approvals")?.count ?? 0}/${FOUNDING_COHORT_SIZE}`}
            />
            <Summary
              label="Biggest drop-off"
              value={biggestDrop ? `${biggestDrop.fromPrevPct}%` : "—"}
              hint={biggestDrop ? `into ${biggestDrop.label}` : undefined}
            />
          </div>

          <section className="mt-6 rounded-xl border border-black/10 bg-white p-4">
            <h2 className="text-sm font-bold text-navy">Stage-by-stage</h2>
            <ol className="mt-4 space-y-4">
              {stages.map((s, i) => {
                const width = top > 0 ? Math.max(2, Math.min(100, (s.count / top) * 100)) : 0;
                const worst = biggestDrop?.key === s.key;
                return (
                  <li key={s.key}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-navy">
                        {i + 1}. {s.label}
                      </span>
                      <span className="text-sm text-black/70">
                        <strong className="text-navy">{s.count}</strong>
                        {s.fromPrevPct !== null ? (
                          <span className="ml-2 text-[11px] text-black/50">
                            {s.fromPrevPct}% of previous
                          </span>
                        ) : null}
                        {s.fromTopPct !== null ? (
                          <span className="ml-2 text-[11px] text-black/40">
                            {s.fromTopPct}% of visitors
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-black/5">
                      <div
                        className={`h-full rounded-full ${worst ? "bg-red-500/80" : "bg-navy"}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-black/45">
                      {worst ? (
                        <span className="mr-1 inline-flex items-center gap-1 font-semibold text-red-600">
                          <TrendingDown size={12} /> Weakest step.
                        </span>
                      ) : null}
                      {STAGE_NOTES[s.key]}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

          <p className="mt-4 text-[11px] text-black/45">
            Generated {new Date(data.generatedAt).toLocaleString()} · milestone timestamps synced for{" "}
            {data.activationSynced} creator{data.activationSynced === 1 ? "" : "s"}.
          </p>
        </>
      )}
    </div>
  );
}

function Summary({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-caps text-black/50">{label}</div>
      <div className="mt-1 text-2xl font-bold text-navy">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-black/45">{hint}</div> : null}
    </div>
  );
}
