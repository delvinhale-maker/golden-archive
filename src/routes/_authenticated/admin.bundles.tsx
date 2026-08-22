import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  adminBundleCandidates,
  adminDeleteBundle,
  adminListBundles,
  adminSaveBundle,
  type AdminBundle,
} from "@/lib/bundles.functions";
import { computeBundleTotals } from "@/lib/bundles";

export const Route = createFileRoute("/_authenticated/admin/bundles")({
  component: AdminBundles,
  head: () => ({
    meta: [
      { title: "Bundles · AurumVault Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Draft = {
  id?: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  imageUrl: string;
  priceDollars: string;
  status: "draft" | "active" | "archived";
  featured: boolean;
  productIds: string[];
};

const EMPTY: Draft = {
  name: "",
  slug: "",
  shortDescription: "",
  fullDescription: "",
  imageUrl: "",
  priceDollars: "",
  status: "draft",
  featured: false,
  productIds: [],
};

function AdminBundles() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListBundles);
  const candidatesFn = useServerFn(adminBundleCandidates);
  const saveFn = useServerFn(adminSaveBundle);
  const deleteFn = useServerFn(adminDeleteBundle);

  const bundles = useQuery({ queryKey: ["admin", "bundles"], queryFn: () => listFn() });
  const candidates = useQuery({
    queryKey: ["admin", "bundle-candidates"],
    queryFn: () => candidatesFn(),
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const priceCents = Math.round(Number(d.priceDollars) * 100);
      return saveFn({
        data: {
          id: d.id,
          name: d.name,
          slug: d.slug || undefined,
          shortDescription: d.shortDescription || undefined,
          fullDescription: d.fullDescription || undefined,
          imageUrl: d.imageUrl || undefined,
          priceCents,
          status: d.status,
          featured: d.featured,
          productIds: d.productIds,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(
        res.savingsCents > 0
          ? `Saved — buyers save $${(res.savingsCents / 100).toFixed(2)} (${res.savingsPct}%)`
          : "Saved — this bundle is priced at or above the sum of its parts",
      );
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["admin", "bundles"] });
      void qc.invalidateQueries({ queryKey: ["bundles"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not save the bundle"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Bundle deleted");
      void qc.invalidateQueries({ queryKey: ["admin", "bundles"] });
      void qc.invalidateQueries({ queryKey: ["bundles"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not delete the bundle"),
  });

  const pool = candidates.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? pool.filter((p) => p.title.toLowerCase().includes(q)) : pool.slice(0, 40);
  }, [pool, search]);

  const picked = useMemo(
    () => (draft ? draft.productIds.map((id) => pool.find((p) => p.id === id)).filter(Boolean) : []),
    [draft, pool],
  ) as { id: string; title: string; priceCents: number }[];

  const totals = draft
    ? computeBundleTotals(
        Math.round(Number(draft.priceDollars || 0) * 100),
        picked.map((p) => p.priceCents),
      )
    : null;

  const startEdit = (b: AdminBundle) =>
    setDraft({
      id: b.id,
      name: b.name,
      slug: b.slug,
      shortDescription: b.shortDescription ?? "",
      fullDescription: b.fullDescription ?? "",
      imageUrl: b.imageUrl ?? "",
      priceDollars: (b.priceCents / 100).toFixed(2),
      status: b.status,
      featured: b.featured,
      productIds: b.items.map((i) => i.productId),
    });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-sm text-black/55 hover:text-navy"
      >
        <ArrowLeft size={16} /> Admin
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Bundles</h1>
          <p className="mt-1 text-sm text-black/55">
            Savings are always calculated from live product prices, so a price change never leaves
            a stale claim on the storefront.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/merchandising"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-navy"
          >
            <BarChart3 size={15} /> AOV analytics
          </Link>
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY })}
            className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-bold text-white"
          >
            <Plus size={15} /> New bundle
          </button>
        </div>
      </div>

      {/* Builder */}
      {draft && (
        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy">
              {draft.id ? "Edit bundle" : "New bundle"}
            </h2>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="text-sm text-black/50 hover:text-navy"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="font-semibold text-navy">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-black/15 px-3"
                placeholder="Creator Launch Toolkit"
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-navy">Web address (optional)</span>
              <input
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-black/15 px-3"
                placeholder="creator-launch-toolkit"
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-navy">Bundle price (USD)</span>
              <input
                inputMode="decimal"
                value={draft.priceDollars}
                onChange={(e) => setDraft({ ...draft, priceDollars: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-black/15 px-3"
                placeholder="79.00"
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-navy">Status</span>
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft({ ...draft, status: e.target.value as Draft["status"] })
                }
                className="mt-1 h-10 w-full rounded-lg border border-black/15 px-3"
              >
                <option value="draft">Draft (hidden)</option>
                <option value="active">Active (live)</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="font-semibold text-navy">Short description</span>
              <input
                value={draft.shortDescription}
                onChange={(e) => setDraft({ ...draft, shortDescription: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-black/15 px-3"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="font-semibold text-navy">Full description</span>
              <textarea
                value={draft.fullDescription}
                onChange={(e) => setDraft({ ...draft, fullDescription: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-black/15 p-3"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="font-semibold text-navy">Cover image URL (optional)</span>
              <input
                value={draft.imageUrl}
                onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-black/15 px-3"
                placeholder="https://..."
              />
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
              />
              <span className="font-semibold text-navy">Feature on the homepage row</span>
            </label>
          </div>

          {/* Product picker */}
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-navy">
                Products in this bundle ({draft.productIds.length})
              </h3>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="h-9 w-56 rounded-full border border-black/15 px-3 text-sm"
              />
            </div>

            {picked.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {picked.map((p) => (
                  <li
                    key={p.id}
                    className="inline-flex items-center gap-2 rounded-full bg-navy/5 px-3 py-1 text-xs font-semibold text-navy"
                  >
                    {p.title} · ${(p.priceCents / 100).toFixed(2)}
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          productIds: draft.productIds.filter((id) => id !== p.id),
                        })
                      }
                      aria-label={`Remove ${p.title}`}
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <ul className="mt-3 max-h-64 divide-y divide-black/5 overflow-y-auto rounded-lg border border-black/10">
              {candidates.isLoading && (
                <li className="flex items-center gap-2 p-3 text-sm text-black/50">
                  <Loader2 size={14} className="animate-spin" /> Loading products…
                </li>
              )}
              {filtered.map((p) => {
                const on = draft.productIds.includes(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          productIds: on
                            ? draft.productIds.filter((id) => id !== p.id)
                            : [...draft.productIds, p.id],
                        })
                      }
                      className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-black/[0.03]"
                    >
                      <span className="min-w-0 truncate text-navy">{p.title}</span>
                      <span className="flex shrink-0 items-center gap-3 text-black/55">
                        ${(p.priceCents / 100).toFixed(2)}
                        {on && <Check size={14} className="text-emerald-600" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Price integrity */}
          {totals && picked.length >= 2 && (
            <div
              className={`mt-5 rounded-xl border p-4 text-sm ${
                totals.needsReview
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
            >
              {totals.needsReview ? (
                <span className="flex items-center gap-2 font-semibold">
                  <AlertTriangle size={15} /> No savings at this price — individual value is $
                  {(totals.individualValueCents / 100).toFixed(2)}.
                </span>
              ) : (
                <span className="font-semibold">
                  Buyers save ${(totals.savingsCents / 100).toFixed(2)} ({totals.savingsPct}%) vs $
                  {(totals.individualValueCents / 100).toFixed(2)} bought separately.
                </span>
              )}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate(draft)}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy disabled:opacity-60"
            >
              {save.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              Save bundle
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-semibold text-navy"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="mt-8 space-y-3">
        {bundles.isLoading && (
          <div className="flex items-center gap-2 text-sm text-black/50">
            <Loader2 size={14} className="animate-spin" /> Loading bundles…
          </div>
        )}
        {bundles.data?.length === 0 && (
          <p className="text-sm text-black/55">No bundles yet. Create your first one above.</p>
        )}
        {bundles.data?.map((b) => (
          <div
            key={b.id}
            className="rounded-xl border border-black/10 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-navy">{b.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      b.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-black/5 text-black/60"
                    }`}
                  >
                    {b.status}
                  </span>
                  {b.needsReview && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      no savings
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-black/55">
                  {b.items.length} products · ${(b.priceCents / 100).toFixed(2)} (value $
                  {(b.individualValueCents / 100).toFixed(2)}) · /bundles/{b.slug}
                </p>
                <p className="mt-1 text-xs text-black/45">
                  {b.views} views · {b.clicks} clicks · {b.purchases} orders · $
                  {(b.revenueCents / 100).toFixed(2)} revenue
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(b)}
                  className="rounded-full border border-black/15 px-4 py-1.5 text-xs font-bold text-navy"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete “${b.name}”? This cannot be undone.`)) del.mutate(b.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-red-200 px-4 py-1.5 text-xs font-bold text-red-600"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
