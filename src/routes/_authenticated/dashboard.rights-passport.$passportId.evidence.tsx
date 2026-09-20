import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, ShieldCheck } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getPassport } from "@/lib/rights-passport.functions";
import { listAssets } from "@/lib/rights-passport-assets.functions";
import { createEvidence, listEvidence } from "@/lib/rights-passport-evidence.functions";
import {
  EVIDENCE_TYPES,
  EVIDENCE_STATUSES,
  EVIDENCE_DISCLAIMER,
  type EvidenceType,
  type EvidenceStatus,
} from "@/lib/rights-passport-workspace.schema";
import { RIGHTS_PASSPORT_DISCLAIMER } from "@/lib/rights-passport.schema";

export const Route = createFileRoute(
  "/_authenticated/dashboard/rights-passport/$passportId/evidence",
)({
  component: EvidencePage,
});

function EvidencePage() {
  const { passportId } = Route.useParams();
  const queryClient = useQueryClient();
  const getPassportFn = useServerFn(getPassport);
  const listAssetsFn = useServerFn(listAssets);
  const listFn = useServerFn(listEvidence);
  const createFn = useServerFn(createEvidence);

  const [passportKey, setPassportKey] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("SOURCE_FILE");
  const [status, setStatus] = useState<EvidenceStatus>("SELF_DECLARED");
  const [sourceCreator, setSourceCreator] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getPassportFn({ data: { id: passportId } })
      .then((p) => setPassportKey(p.passport_key))
      .catch(() => setPassportKey(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId]);

  const { data: assets } = useQuery({
    queryKey: ["rights-passport", "assets", passportKey],
    queryFn: () => listAssetsFn({ data: { passportKey: passportKey! } }),
    enabled: !!passportKey,
  });
  const { data: evidence, isLoading } = useQuery({
    queryKey: ["rights-passport", "evidence", passportKey],
    queryFn: () => listFn({ data: { passportKey: passportKey! } }),
    enabled: !!passportKey,
  });

  async function handleCreate() {
    if (!passportKey) return;
    if (!assetId) return toast.error("Choose an asset");
    setCreating(true);
    try {
      await createFn({
        data: { passportKey, assetId, evidenceType, status, sourceCreator: sourceCreator || null },
      });
      setSourceCreator("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["rights-passport", "evidence", passportKey] });
      toast.success("Evidence added");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't add evidence");
    } finally {
      setCreating(false);
    }
  }

  const assetNameById = new Map((assets ?? []).map((a) => [a.id, a.name]));

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/rights-passport"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to Passport Home
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-navy">Provenance & Evidence Register™</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105"
        >
          <Plus size={15} /> Add Evidence
        </button>
      </div>
      <p className="mt-2 max-w-xl text-sm text-mute font-medium">{EVIDENCE_DISCLAIMER}</p>

      {showForm && (
        <section className="mt-5 rounded-2xl border border-ink/10 bg-white p-5 space-y-3">
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy"
          >
            <option value="">Choose an asset…</option>
            {(assets ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <input
            value={sourceCreator}
            onChange={(e) => setSourceCreator(e.target.value)}
            placeholder="Source / creator (optional)"
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-3">
            <select
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy"
            >
              {EVIDENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EvidenceStatus)}
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy"
            >
              {EVIDENCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy disabled:opacity-50"
            >
              {creating ? "Saving…" : "Add"}
            </button>
          </div>
        </section>
      )}

      {isLoading ? (
        <p className="mt-8 text-mute">Loading…</p>
      ) : !evidence?.length ? (
        <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <p className="font-display text-xl text-navy">No evidence records yet</p>
          <p className="text-sm text-mute mt-2">
            Attach supporting documents or references to your registered assets.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {evidence.map((e) => (
            <li key={e.id} className="rounded-xl border border-ink/10 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-navy">{e.evidence_type.replace(/_/g, " ")}</p>
                <span className="rounded-full border border-ink/10 px-2.5 py-0.5 text-[11px] font-medium text-mute">
                  {assetNameById.get(e.asset_id) ?? "Unknown asset"}
                </span>
                <span className="rounded-full border border-ink/10 px-2.5 py-0.5 text-[11px] font-medium text-mute">
                  {e.status.replace(/_/g, " ")}
                </span>
                {e.has_content_credential && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-navy/5 px-2.5 py-0.5 text-[11px] font-bold text-navy">
                    <ShieldCheck size={11} /> Content Credential
                  </span>
                )}
              </div>
              {e.source_creator && (
                <p className="text-xs text-mute mt-1">Source: {e.source_creator}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 max-w-xl text-xs text-mute italic">{RIGHTS_PASSPORT_DISCLAIMER}</p>
    </PublisherShell>
  );
}
