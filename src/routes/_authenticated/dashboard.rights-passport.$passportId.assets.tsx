import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Archive, AlertTriangle } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getPassport } from "@/lib/rights-passport.functions";
import { createAsset, listAssets, archiveAsset } from "@/lib/rights-passport-assets.functions";
import {
  ASSET_TYPES,
  CONTROL_BASES,
  RIGHTS_PASSPORT_DISCLAIMER,
  type AssetType,
  type ControlBasis,
} from "@/lib/rights-passport.schema";

export const Route = createFileRoute(
  "/_authenticated/dashboard/rights-passport/$passportId/assets",
)({
  component: AssetRegistryPage,
});

function AssetRegistryPage() {
  const { passportId } = Route.useParams();
  const queryClient = useQueryClient();
  const getPassportFn = useServerFn(getPassport);
  const listFn = useServerFn(listAssets);
  const createFn = useServerFn(createAsset);
  const archiveFn = useServerFn(archiveAsset);

  const [passportKey, setPassportKey] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("CREATIVE_WORK");
  const [controlBasis, setControlBasis] = useState<ControlBasis>("REVIEW_REQUIRED");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getPassportFn({ data: { id: passportId } })
      .then((p) => setPassportKey(p.passport_key))
      .catch(() => setPassportKey(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId]);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["rights-passport", "assets", passportKey],
    queryFn: () => listFn({ data: { passportKey: passportKey! } }),
    enabled: !!passportKey,
  });

  async function handleCreate() {
    if (!passportKey) return;
    if (!name.trim()) return toast.error("Give this asset a name");
    setCreating(true);
    try {
      await createFn({ data: { passportKey, name, assetType, controlBasis } });
      setName("");
      setAssetType("CREATIVE_WORK");
      setControlBasis("REVIEW_REQUIRED");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["rights-passport", "assets", passportKey] });
      toast.success("Asset registered");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't register asset");
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this asset?")) return;
    try {
      await archiveFn({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["rights-passport", "assets", passportKey] });
      toast.success("Asset archived");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't archive asset");
    }
  }

  const rows = (assets ?? []).filter((a) => a.status !== "ARCHIVED");

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/rights-passport"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to Passport Home
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-navy">Rights Asset Registry™</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105"
        >
          <Plus size={15} /> Register Asset
        </button>
      </div>

      {showForm && (
        <section className="mt-5 rounded-2xl border border-ink/10 bg-white p-5 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={'Asset name (e.g. "Midnight Run" — feature film)'}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-3">
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy"
            >
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <select
              value={controlBasis}
              onChange={(e) => setControlBasis(e.target.value as ControlBasis)}
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy"
            >
              {CONTROL_BASES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
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
          <p className="text-[11px] text-mute">
            Not sure of the control basis yet? Leave it as REVIEW REQUIRED — that's the safe
            default, not an error.
          </p>
        </section>
      )}

      {isLoading ? (
        <p className="mt-8 text-mute">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <p className="font-display text-xl text-navy">No assets registered yet</p>
          <p className="text-sm text-mute mt-2">
            Add your name, likeness, creative works, and other assets to build your registry.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-ink/10 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-navy truncate">{a.name}</p>
                  <span className="shrink-0 rounded-full border border-ink/10 px-2.5 py-0.5 text-[11px] font-medium text-mute">
                    {a.asset_type.replace(/_/g, " ")}
                  </span>
                  {(a.control_basis === "REVIEW_REQUIRED" || a.status === "REVIEW_REQUIRED") && (
                    <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                      <AlertTriangle size={11} /> REVIEW REQUIRED
                    </span>
                  )}
                  {a.status === "DISPUTED" && (
                    <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                      DISPUTED
                    </span>
                  )}
                </div>
                <p className="text-xs text-mute mt-1">
                  Control basis: {a.control_basis.replace(/_/g, " ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleArchive(a.id)}
                className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Archive size={13} /> Archive
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 max-w-xl text-xs text-mute italic">{RIGHTS_PASSPORT_DISCLAIMER}</p>
    </PublisherShell>
  );
}
