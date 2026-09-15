import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, AlertTriangle } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getPassport } from "@/lib/rights-passport.functions";
import { listAssets } from "@/lib/rights-passport-assets.functions";
import { createLicense, listLicenses } from "@/lib/rights-passport-licenses.functions";
import {
  LICENSE_PERMISSION_TYPES,
  LICENSE_STATUSES,
  type LicensePermissionType,
  type LicenseStatus,
} from "@/lib/rights-passport-workspace.schema";
import { RIGHTS_PASSPORT_DISCLAIMER } from "@/lib/rights-passport.schema";

export const Route = createFileRoute(
  "/_authenticated/dashboard/rights-passport/$passportId/licenses",
)({
  component: LicensesPage,
});

function isPastDate(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

function LicensesPage() {
  const { passportId } = Route.useParams();
  const queryClient = useQueryClient();
  const getPassportFn = useServerFn(getPassport);
  const listAssetsFn = useServerFn(listAssets);
  const listFn = useServerFn(listLicenses);
  const createFn = useServerFn(createLicense);

  const [passportKey, setPassportKey] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [licensee, setLicensee] = useState("");
  const [permissionType, setPermissionType] = useState<LicensePermissionType>("LICENSE");
  const [status, setStatus] = useState<LicenseStatus>("REVIEW_REQUIRED");
  const [isExclusive, setIsExclusive] = useState(false);
  const [endDate, setEndDate] = useState("");
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
  const { data: licenses, isLoading } = useQuery({
    queryKey: ["rights-passport", "licenses", passportKey],
    queryFn: () => listFn({ data: { passportKey: passportKey! } }),
    enabled: !!passportKey,
  });

  async function handleCreate() {
    if (!passportKey) return;
    if (!assetId) return toast.error("Choose an asset");
    if (!licensee.trim()) return toast.error("Enter a licensee");
    setCreating(true);
    try {
      await createFn({
        data: {
          passportKey,
          assetId,
          licensee,
          permissionType,
          status,
          isExclusive,
          endDate: endDate || null,
        },
      });
      setLicensee("");
      setEndDate("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["rights-passport", "licenses", passportKey] });
      toast.success("License added");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't add license");
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
        <h1 className="font-display text-3xl text-navy">License Register™</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105"
        >
          <Plus size={15} /> Add License
        </button>
      </div>

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
            value={licensee}
            onChange={(e) => setLicensee(e.target.value)}
            placeholder="Licensee (who this license is granted to)"
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-3">
            <select
              value={permissionType}
              onChange={(e) => setPermissionType(e.target.value as LicensePermissionType)}
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy"
            >
              {LICENSE_PERMISSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LicenseStatus)}
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy"
            >
              {LICENSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-1.5 text-sm text-navy">
              <input
                type="checkbox"
                checked={isExclusive}
                onChange={(e) => setIsExclusive(e.target.checked)}
              />
              Exclusive
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
              placeholder="End date"
            />
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
      ) : !licenses?.length ? (
        <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <p className="font-display text-xl text-navy">No licenses yet</p>
          <p className="text-sm text-mute mt-2">
            Add a license once you attach it to a registered asset.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {licenses.map((l) => {
            const expired = l.status === "ACTIVE" && isPastDate(l.end_date);
            return (
              <li key={l.id} className="rounded-xl border border-ink/10 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-navy">{l.licensee}</p>
                  <span className="rounded-full border border-ink/10 px-2.5 py-0.5 text-[11px] font-medium text-mute">
                    {assetNameById.get(l.asset_id) ?? "Unknown asset"}
                  </span>
                  <span className="rounded-full border border-ink/10 px-2.5 py-0.5 text-[11px] font-medium text-mute">
                    {l.status.replace(/_/g, " ")}
                  </span>
                  {l.is_exclusive && (
                    <span className="rounded-full bg-navy/5 px-2.5 py-0.5 text-[11px] font-bold text-navy">
                      EXCLUSIVE
                    </span>
                  )}
                  {expired && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                      <AlertTriangle size={11} /> END DATE HAS PASSED — still marked ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-mute mt-1">
                  {l.permission_type.replace(/_/g, " ")}
                  {l.end_date ? ` · ends ${l.end_date}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 max-w-xl text-xs text-mute italic">{RIGHTS_PASSPORT_DISCLAIMER}</p>
    </PublisherShell>
  );
}
