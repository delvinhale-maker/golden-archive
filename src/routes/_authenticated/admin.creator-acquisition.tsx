import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, RefreshCw, Send, Users } from "lucide-react";
import { toast } from "sonner";
import {
  getCreatorAcquisitionMetrics,
  retryStarterPackEmail,
  type CreatorAcquisitionMetrics,
} from "@/lib/starter-pack.functions";

export const Route = createFileRoute("/_authenticated/admin/creator-acquisition")({
  component: CreatorAcquisitionPage,
  head: () => ({
    meta: [
      { title: "Creator Acquisition · AurumVault Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const RANGES = [7, 30, 90] as const;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-caps text-black/50">{label}</div>
      <div className="mt-1 text-2xl font-bold text-navy">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-black/45">{hint}</div> : null}
    </div>
  );
}

const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : "—");

function CreatorAcquisitionPage() {
  const fetchMetrics = useServerFn(getCreatorAcquisitionMetrics);
  const retry = useServerFn(retryStarterPackEmail);
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<CreatorAcquisitionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(
    async (range: number) => {
      setLoading(true);
      try {
        setData(await fetchMetrics({ data: { days: range } }));
      } catch (e: any) {
        toast.error(e?.message ?? "Could not load acquisition metrics");
      } finally {
        setLoading(false);
      }
    },
    [fetchMetrics],
  );

  useEffect(() => {
    void load(days);
  }, [days, load]);

  async function onRetry(leadId: string) {
    setRetrying(leadId);
    try {
      await retry({ data: { leadId } });
      toast.success("Starter Pack email re-queued");
      await load(days);
    } catch (e: any) {
      toast.error(e?.message ?? "Retry failed");
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-black/60 hover:text-navy">
        <ArrowLeft size={15} /> Admin
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-navy">
          <Users size={20} /> Creator Acquisition
        </h1>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`min-h-[36px] rounded-lg border px-3 text-sm font-semibold ${
                days === r ? "border-navy bg-navy text-white" : "border-black/15 text-black/60"
              }`}
            >
              {r}d
            </button>
          ))}
          <button
            onClick={() => void load(days)}
            className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-black/15 px-3 text-sm text-black/60"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {loading && !data ? (
        <p className="mt-10 flex items-center gap-2 text-sm text-black/50">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </p>
      ) : !data ? null : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Starter Pack signups" value={String(data.signups)} />
            <Stat label="Unique leads" value={String(data.uniqueLeads)} />
            <Stat
              label="Marketing opt-in"
              value={pct(data.marketingOptIns, data.signups)}
              hint={`${data.marketingOptIns} opted in`}
            />
            <Stat
              label="Delivered"
              value={pct(data.emailsDelivered, data.uniqueLeads)}
              hint={`${data.emailsDelivered} confirmed by provider`}
            />
            <Stat label="Queued" value={String(data.emailsQueued)} />
            <Stat label="Delivery failures" value={String(data.emailFailures)} />
            <Stat label="Download clicks" value={String(data.downloadClicks)} />
            <Stat label="Application clicks" value={String(data.applicationClicks)} />
            <Stat
              label="Applications submitted"
              value={String(data.applicationsSubmitted)}
              hint={pct(data.applicationsSubmitted, data.uniqueLeads)}
            />
            <Stat
              label="Approved creators"
              value={String(data.approvedCreators)}
              hint={pct(data.approvedCreators, data.uniqueLeads)}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              { title: "Top traffic sources", rows: data.topSources },
              { title: "Top campaigns", rows: data.topCampaigns },
            ].map(({ title, rows }) => (
              <section key={title} className="rounded-xl border border-black/10 bg-white p-4">
                <h2 className="text-sm font-bold text-navy">{title}</h2>
                {rows.length === 0 ? (
                  <p className="mt-3 text-sm text-black/50">No data in this range yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm">
                    {rows.map((r) => (
                      <li key={r.key} className="flex justify-between gap-3">
                        <span className="truncate text-black/70">{r.key}</span>
                        <span className="font-semibold text-navy">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <section className="mt-6 rounded-xl border border-black/10 bg-white p-4">
            <h2 className="text-sm font-bold text-navy">Recent leads</h2>
            {data.leads.length === 0 ? (
              <p className="mt-3 text-sm text-black/50">No Starter Pack leads in this range yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-caps text-black/50">
                      <th className="py-2 pr-3 font-semibold">Lead</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 font-semibold">Consent</th>
                      <th className="py-2 pr-3 font-semibold">Source</th>
                      <th className="py-2 pr-3 font-semibold">Campaign</th>
                      <th className="py-2 pr-3 font-semibold">Delivery</th>
                      <th className="py-2 pr-3 font-semibold">Applicant</th>
                      <th className="py-2 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.leads.map((l) => (
                      <tr key={l.id} className="border-t border-black/5">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-navy">{l.firstName || "—"}</div>
                          <div className="text-[11px] text-black/50">{l.email}</div>
                        </td>
                        <td className="py-2 pr-3 text-black/70">{l.leadStatus}</td>
                        <td className="py-2 pr-3 text-black/70">{l.marketingConsent ? "Yes" : "No"}</td>
                        <td className="py-2 pr-3 text-black/70">{l.utmSource ?? "direct"}</td>
                        <td className="py-2 pr-3 text-black/70">{l.utmCampaign ?? "—"}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={
                              l.sendStatus?.startsWith("failed")
                                ? "font-semibold text-red-600"
                                : "text-black/70"
                            }
                          >
                            {l.sendStatus ?? "—"}
                          </span>
                          <div className="text-[11px] text-black/45">{l.sendCount} sent</div>
                        </td>
                        <td className="py-2 pr-3 text-black/70">
                          {l.convertedAt ? "Creator" : l.applicationId ? "Applied" : "—"}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => void onRetry(l.id)}
                            disabled={retrying === l.id}
                            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-black/15 px-3 text-[12px] font-semibold text-black/70 disabled:opacity-50"
                          >
                            {retrying === l.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Send size={13} />
                            )}
                            Resend
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
