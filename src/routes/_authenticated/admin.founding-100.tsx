import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Crown, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getFoundingMetrics } from "@/lib/founding.functions";
import {
  PROSPECT_STATUSES,
  deleteCreatorProspect,
  listCreatorProspects,
  saveCreatorProspect,
  type CreatorProspect,
  type ProspectStatus,
} from "@/lib/creator-prospects.functions";
import { formatFoundingNumber } from "@/lib/founding";

export const Route = createFileRoute("/_authenticated/admin/founding-100")({
  component: FoundingCommandCenter,
  head: () => ({
    meta: [
      { title: "Founding 100 Command Center · AurumVault Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-caps text-black/50">{label}</div>
      <div className="mt-1 text-2xl font-bold text-navy">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-black/45">{hint}</div> : null}
    </div>
  );
}

/** Visitor → starter pack → application → approval → first product → first sale. */
function FunnelPanel() {
  const fetchFunnel = useServerFn(getFoundingFunnel);
  const funnel = useQuery({ queryKey: ["founding-funnel"], queryFn: () => fetchFunnel() });
  const data = funnel.data;
  const top = data?.stages[0]?.count ?? 0;

  return (
    <section className="mt-6 rounded-xl border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold text-navy">Conversion funnel</h2>
      {funnel.isLoading ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-black/50">
          <Loader2 size={16} className="animate-spin" /> Measuring funnel…
        </p>
      ) : !data ? (
        <p className="mt-3 text-sm text-black/50">Funnel data unavailable.</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {data.stages.map((s) => (
              <li key={s.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-black/70">{s.label}</span>
                  <span className="font-semibold text-navy">
                    {s.count}
                    {s.fromPrevPct !== null ? (
                      <span className="ml-2 text-[11px] font-normal text-black/45">
                        {s.fromPrevPct}% of previous
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full bg-navy"
                    style={{ width: `${top > 0 ? Math.min(100, (s.count / top) * 100) : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-black/45">
            Counted from click events, leads, applications, cohort rows, published products and
            order items. Milestones synced for {data.activationSynced} creator
            {data.activationSynced === 1 ? "" : "s"}.
          </p>
        </>
      )}
    </section>
  );
}

const EMPTY = {
  name: "",
  platform: "",
  profileUrl: "",
  contactEmail: "",
  niche: "",
  audienceSize: "",
  status: "identified" as ProspectStatus,
  notes: "",
};

function FoundingCommandCenter() {
  const fetchMetrics = useServerFn(getFoundingMetrics);
  const fetchProspects = useServerFn(listCreatorProspects);
  const save = useServerFn(saveCreatorProspect);
  const remove = useServerFn(deleteCreatorProspect);
  const qc = useQueryClient();

  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const metrics = useQuery({ queryKey: ["founding-metrics"], queryFn: () => fetchMetrics() });
  const prospects = useQuery({ queryKey: ["creator-prospects"], queryFn: () => fetchProspects() });

  async function submit() {
    if (!form.name.trim()) {
      toast.error("A prospect needs a name.");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          ...(editingId ? { id: editingId } : {}),
          name: form.name,
          platform: form.platform,
          profileUrl: form.profileUrl,
          contactEmail: form.contactEmail,
          niche: form.niche,
          audienceSize: form.audienceSize ? Number(form.audienceSize) : null,
          status: form.status,
          notes: form.notes,
        },
      });
      toast.success(editingId ? "Prospect updated" : "Prospect added");
      setForm({ ...EMPTY });
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: ["creator-prospects"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save prospect");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(p: CreatorProspect) {
    if (!window.confirm(`Delete prospect ${p.name}?`)) return;
    try {
      await remove({ data: { id: p.id } });
      await qc.invalidateQueries({ queryKey: ["creator-prospects"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  }

  const m = metrics.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-black/60 hover:text-navy">
        <ArrowLeft size={15} /> Admin
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-navy">
          <Crown size={20} /> Founding 100 Command Center
        </h1>
        <button
          onClick={() => {
            void metrics.refetch();
            void prospects.refetch();
          }}
          className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-black/15 px-3 text-sm text-black/60"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {metrics.isLoading ? (
        <p className="mt-10 flex items-center gap-2 text-sm text-black/50">
          <Loader2 size={16} className="animate-spin" /> Loading cohort metrics…
        </p>
      ) : !m ? (
        <p className="mt-10 text-sm text-black/50">Cohort metrics unavailable.</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Accepted" value={`${m.accepted}/${m.cohortSize}`} />
            <Stat label="Spots remaining" value={String(m.remaining)} hint={m.isFull ? "Cohort full" : undefined} />
            <Stat label="Campaign applications" value={String(m.campaignApplications)} />
            <Stat label="Awaiting review" value={String(m.campaignApplicationsPending)} />
            <Stat label="Campaign approved" value={String(m.campaignApplicationsApproved)} />
            <Stat label="Page views" value={String(m.pageViews)} />
            <Stat label="Apply clicks" value={String(m.applyClicks)} />
            <Stat
              label="Click → application"
              value={m.applyClicks > 0 ? `${Math.round((m.campaignApplications / m.applyClicks) * 100)}%` : "—"}
            />
          </div>

          <FunnelPanel />

          <section className="mt-6 rounded-xl border border-black/10 bg-white p-4">
            <h2 className="text-sm font-bold text-navy">Latest founding creators</h2>
            {m.acceptedRecent.length === 0 ? (
              <p className="mt-3 text-sm text-black/50">
                No founding creators yet. Accept an approved application from the applications board.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-black/5 text-sm">
                {m.acceptedRecent.map((r) => (
                  <li key={r.foundingNumber} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-mono text-navy">{formatFoundingNumber(r.foundingNumber)}</span>
                    <span className="flex-1 truncate text-black/70">{r.brandName ?? "—"}</span>
                    <span className="text-[11px] text-black/45">
                      {new Date(r.acceptedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="mt-6 rounded-xl border border-black/10 bg-white p-4">
        <h2 className="text-sm font-bold text-navy">Outreach tracker</h2>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["name", "Creator name"],
              ["platform", "Platform"],
              ["profileUrl", "Profile URL"],
              ["contactEmail", "Contact email"],
              ["niche", "Niche"],
              ["audienceSize", "Audience size"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-[11px] font-semibold uppercase tracking-caps text-black/50">
              {label}
              <input
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                inputMode={key === "audienceSize" ? "numeric" : undefined}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-navy"
              />
            </label>
          ))}
          <label className="text-[11px] font-semibold uppercase tracking-caps text-black/50">
            Status
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProspectStatus }))}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-navy"
            >
              {PROSPECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-caps text-black/50 sm:col-span-2">
            Notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-navy"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-navy px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {editingId ? "Save changes" : "Add prospect"}
          </button>
          {editingId ? (
            <button
              onClick={() => {
                setEditingId(null);
                setForm({ ...EMPTY });
              }}
              className="min-h-[40px] rounded-lg border border-black/15 px-4 text-sm text-black/60"
            >
              Cancel
            </button>
          ) : null}
        </div>

        {prospects.isLoading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-black/50">
            <Loader2 size={15} className="animate-spin" /> Loading prospects…
          </p>
        ) : (prospects.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-black/50">No prospects tracked yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-caps text-black/50">
                  <th className="py-2 pr-3 font-semibold">Creator</th>
                  <th className="py-2 pr-3 font-semibold">Platform</th>
                  <th className="py-2 pr-3 font-semibold">Niche</th>
                  <th className="py-2 pr-3 font-semibold">Audience</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {(prospects.data ?? []).map((p) => (
                  <tr key={p.id} className="border-t border-black/5">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-navy">{p.name}</div>
                      <div className="text-[11px] text-black/50">{p.contactEmail ?? "—"}</div>
                    </td>
                    <td className="py-2 pr-3 text-black/70">{p.platform ?? "—"}</td>
                    <td className="py-2 pr-3 text-black/70">{p.niche ?? "—"}</td>
                    <td className="py-2 pr-3 tabular-nums text-black/70">
                      {p.audienceSize?.toLocaleString() ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-black/70">{p.status.replace(/_/g, " ")}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingId(p.id);
                            setForm({
                              name: p.name,
                              platform: p.platform ?? "",
                              profileUrl: p.profileUrl ?? "",
                              contactEmail: p.contactEmail ?? "",
                              niche: p.niche ?? "",
                              audienceSize: p.audienceSize ? String(p.audienceSize) : "",
                              status: p.status,
                              notes: p.notes ?? "",
                            });
                          }}
                          className="min-h-[34px] rounded-lg border border-black/15 px-3 text-[12px] font-semibold text-black/70"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void onDelete(p)}
                          aria-label={`Delete ${p.name}`}
                          className="inline-flex min-h-[34px] items-center rounded-lg border border-black/15 px-3 text-black/50 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
