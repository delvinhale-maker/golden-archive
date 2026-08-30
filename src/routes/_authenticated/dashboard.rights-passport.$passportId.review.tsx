import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, CheckCircle2, EyeOff, Ban } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getPassport } from "@/lib/rights-passport.functions";
import { syncReviewFlags, setReviewFlagStatus } from "@/lib/rights-passport-review.functions";
import type { FlagSeverity, FlagStatus } from "@/lib/rights-passport-workspace.schema";
import { RIGHTS_PASSPORT_DISCLAIMER } from "@/lib/rights-passport.schema";

export const Route = createFileRoute(
  "/_authenticated/dashboard/rights-passport/$passportId/review",
)({
  component: RiskReviewPage,
});

const SEVERITY_TONE: Record<FlagSeverity, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  MODERATE: "bg-sky-50 text-sky-700 border-sky-200",
  LOW: "bg-ink/5 text-mute border-ink/10",
};

const STATUS_LABELS: Record<FlagStatus, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
  ACCEPTED_RISK: "Accepted Risk",
};

function RiskReviewPage() {
  const { passportId } = Route.useParams();
  const queryClient = useQueryClient();
  const getPassportFn = useServerFn(getPassport);
  const syncFn = useServerFn(syncReviewFlags);
  const setStatusFn = useServerFn(setReviewFlagStatus);

  const [passportKey, setPassportKey] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    getPassportFn({ data: { id: passportId } })
      .then((p) => setPassportKey(p.passport_key))
      .catch(() => setPassportKey(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId]);

  const queryKey = ["rights-passport", "review", passportId];
  const { data: flags, isLoading } = useQuery({
    queryKey,
    queryFn: () => syncFn({ data: { id: passportId } }),
    enabled: !!passportKey,
  });

  async function handleStatus(id: string, status: FlagStatus) {
    setUpdating(id);
    try {
      await setStatusFn({ data: { id, status } });
      queryClient.invalidateQueries({ queryKey });
      toast.success("Updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't update");
    } finally {
      setUpdating(null);
    }
  }

  const openFlags = (flags ?? []).filter((f) => f.status === "OPEN" || f.status === "ACKNOWLEDGED");
  const closedFlags = (flags ?? []).filter(
    (f) => f.status === "RESOLVED" || f.status === "ACCEPTED_RISK",
  );

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/rights-passport"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to Passport Home
      </Link>
      <h1 className="mt-3 font-display text-3xl text-navy">Risk & Conflict Review™</h1>
      <p className="text-sm text-mute mt-1 max-w-xl">
        Deterministic checks across your identity, assets, AI consent, licenses, and evidence. These
        flags point out gaps and conflicts to review — they are not legal determinations.
      </p>

      {isLoading && <p className="mt-6 text-sm text-mute">Loading…</p>}

      {!isLoading && (flags ?? []).length === 0 && (
        <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-8 text-center max-w-xl">
          <ShieldAlert className="mx-auto text-mute" size={28} />
          <p className="text-sm text-mute mt-3">No review flags right now.</p>
        </div>
      )}

      {openFlags.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-mute">
            Needs attention ({openFlags.length})
          </p>
          {openFlags.map((f) => (
            <div key={f.id} className="rounded-xl border border-ink/10 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${SEVERITY_TONE[f.severity]}`}
                    >
                      {f.severity}
                    </span>
                    <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-mute">
                      {STATUS_LABELS[f.status]}
                    </span>
                    <p className="font-semibold text-navy">{f.title}</p>
                  </div>
                  <p className="text-xs text-mute mt-1">{f.description}</p>
                  {f.evidence_context && (
                    <p className="text-xs text-ink/70 mt-1 italic">{f.evidence_context}</p>
                  )}
                  {f.recommended_action && (
                    <p className="text-xs text-navy mt-1">
                      <strong>Next move:</strong> {f.recommended_action}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {f.status === "OPEN" && (
                    <button
                      type="button"
                      disabled={updating === f.id}
                      onClick={() => handleStatus(f.id, "ACKNOWLEDGED")}
                      className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy/30"
                    >
                      <EyeOff size={12} /> Acknowledge
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={updating === f.id}
                    onClick={() => handleStatus(f.id, "ACCEPTED_RISK")}
                    className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy/30"
                  >
                    <Ban size={12} /> Accept Risk
                  </button>
                  <button
                    type="button"
                    disabled={updating === f.id}
                    onClick={() => handleStatus(f.id, "RESOLVED")}
                    className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-navy hover:brightness-105"
                  >
                    <CheckCircle2 size={12} /> Mark Resolved
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {closedFlags.length > 0 && (
        <div className="mt-8 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-mute">
            Resolved / accepted ({closedFlags.length})
          </p>
          {closedFlags.map((f) => (
            <div key={f.id} className="rounded-xl border border-ink/10 bg-ivory/60 p-4 opacity-80">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${SEVERITY_TONE[f.severity]}`}
                >
                  {f.severity}
                </span>
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-mute">
                  {STATUS_LABELS[f.status]}
                </span>
                <p className="font-semibold text-navy text-sm">{f.title}</p>
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  disabled={updating === f.id}
                  onClick={() => handleStatus(f.id, "OPEN")}
                  className="text-xs text-mute hover:text-navy underline"
                >
                  Reopen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 max-w-xl text-xs text-mute italic">{RIGHTS_PASSPORT_DISCLAIMER}</p>
    </PublisherShell>
  );
}
