import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowLeft, Upload } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyVariants,
  saveMyVariants,
  type ProductVariant,
  type LicenseType,
} from "@/lib/product-variants.functions";

export const Route = createFileRoute("/_authenticated/dashboard/variants/$id")({
  component: VariantsPage,
});

type Draft = {
  id?: string;
  name: string;
  description: string;
  license_type: LicenseType | "";
  price_dollars: string;
  pay_what_you_want: boolean;
  min_price_dollars: string;
  file_path: string;
  file_size_bytes: number | null;
  sort_order: number;
  is_active: boolean;
  uploading?: boolean;
};

const LICENSES: { value: LicenseType; label: string }[] = [
  { value: "personal", label: "Personal Use" },
  { value: "commercial", label: "Commercial License" },
  { value: "extended", label: "Extended License" },
];

function toDraft(v: ProductVariant): Draft {
  return {
    id: v.id,
    name: v.name,
    description: v.description ?? "",
    license_type: v.license_type ?? "",
    price_dollars: (v.price_cents / 100).toFixed(2),
    pay_what_you_want: v.pay_what_you_want,
    min_price_dollars: ((v.min_price_cents ?? 0) / 100).toFixed(2),
    file_path: v.file_path ?? "",
    file_size_bytes: v.file_size_bytes,
    sort_order: v.sort_order,
    is_active: v.is_active,
  };
}

function VariantsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [productTitle, setProductTitle] = useState<string>("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: prod } = await supabase
          .from("marketplace_products")
          .select("title,seller_id")
          .eq("id", id)
          .maybeSingle();
        if (cancelled) return;
        if (!prod || prod.seller_id !== user.id) {
          toast.error("You don't have access to this product");
          navigate({ to: "/dashboard" });
          return;
        }
        setProductTitle(prod.title);
        const rows = await listMyVariants({ data: { productId: id } });
        if (!cancelled) setDrafts(rows.map(toDraft));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load variants");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user, authLoading, navigate]);

  function updateDraft(i: number, patch: Partial<Draft>) {
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function addVariant() {
    setDrafts((d) => [
      ...d,
      {
        name: `Tier ${d.length + 1}`,
        description: "",
        license_type: "",
        price_dollars: "19.99",
        pay_what_you_want: false,
        min_price_dollars: "0.00",
        file_path: "",
        file_size_bytes: null,
        sort_order: d.length,
        is_active: true,
      },
    ]);
  }

  function removeVariant(i: number) {
    setDrafts((d) => d.filter((_, idx) => idx !== i));
  }

  async function uploadFile(i: number, file: File) {
    if (!user) return;
    updateDraft(i, { uploading: true });
    try {
      const ts = Date.now();
      const path = `${user.id}/${ts}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const up = await supabase.storage.from("product-files").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      updateDraft(i, { file_path: path, file_size_bytes: file.size, uploading: false });
      toast.success("File uploaded");
    } catch (e) {
      updateDraft(i, { uploading: false });
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const variants = drafts.map((d, idx) => ({
        id: d.id,
        name: d.name.trim(),
        description: d.description.trim() || null,
        license_type: d.license_type === "" ? null : (d.license_type as LicenseType),
        price_cents: Math.max(0, Math.round(parseFloat(d.price_dollars || "0") * 100)),
        pay_what_you_want: d.pay_what_you_want,
        min_price_cents: d.pay_what_you_want
          ? Math.max(0, Math.round(parseFloat(d.min_price_dollars || "0") * 100))
          : null,
        file_path: d.file_path.trim() || null,
        file_size_bytes: d.file_size_bytes ?? null,
        sort_order: idx,
        is_active: d.is_active,
      }));
      for (const v of variants) {
        if (!v.name) throw new Error("Every variant needs a name");
        if (!v.pay_what_you_want && v.price_cents < 50) {
          throw new Error(`${v.name}: price must be at least $0.50`);
        }
      }
      await saveMyVariants({ data: { productId: id, variants } });
      toast.success("Variants saved");
      const rows = await listMyVariants({ data: { productId: id } });
      setDrafts(rows.map(toDraft));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PublisherShell accent={ACCENTS.publishStep2}>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <Loader2 className="mx-auto animate-spin text-gold-ink" />
        </div>
      </PublisherShell>
    );
  }

  return (
    <PublisherShell accent={ACCENTS.publishStep2}>
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-mute hover:text-ink"
        >
          <ArrowLeft size={14} /> Back to Bookshelf
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">
          Variants · {productTitle}
        </h1>
        <p className="mt-2 text-sm text-mute">
          Offer multiple tiers, license options, or Pay-What-You-Want pricing. Leave empty to sell the product at its base price only.
        </p>

        <div className="mt-8 space-y-4">
          {drafts.length === 0 && (
            <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-mute">
              No variants yet. Add one to offer tiers or license options.
            </div>
          )}
          {drafts.map((d, i) => (
            <div key={i} className="rounded-xl border border-line bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <input
                  className="flex-1 rounded-lg border border-line px-3 py-2 font-display text-lg font-bold text-ink outline-none focus:border-gold"
                  placeholder="Variant name (e.g. Pro, Commercial License)"
                  value={d.name}
                  onChange={(e) => updateDraft(i, { name: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  className="rounded-full p-2 text-red-600 hover:bg-red-50"
                  aria-label="Remove variant"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-caps text-mute">License Type</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-gold"
                    value={d.license_type}
                    onChange={(e) => updateDraft(i, { license_type: e.target.value as LicenseType | "" })}
                  >
                    <option value="">(none)</option>
                    {LICENSES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-caps text-mute">
                    {d.pay_what_you_want ? "Minimum Price ($)" : "Price ($)"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-gold"
                    value={d.pay_what_you_want ? d.min_price_dollars : d.price_dollars}
                    onChange={(e) =>
                      updateDraft(
                        i,
                        d.pay_what_you_want
                          ? { min_price_dollars: e.target.value }
                          : { price_dollars: e.target.value },
                      )
                    }
                  />
                </label>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={d.pay_what_you_want}
                  onChange={(e) => updateDraft(i, { pay_what_you_want: e.target.checked })}
                  className="h-4 w-4 accent-gold"
                />
                Pay-What-You-Want (buyer names their price above the minimum)
              </label>

              <label className="mt-4 block">
                <span className="text-[11px] font-bold uppercase tracking-caps text-mute">Description / What's included</span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-gold"
                  rows={3}
                  placeholder="Bulleted features, file list, or a short summary…"
                  value={d.description}
                  onChange={(e) => updateDraft(i, { description: e.target.value })}
                />
              </label>

              <div className="mt-4 rounded-lg bg-paper p-3">
                <div className="text-[11px] font-bold uppercase tracking-caps text-mute">Deliverable file</div>
                {d.file_path ? (
                  <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-ink">{d.file_path.split("/").pop()}</span>
                    <button
                      type="button"
                      onClick={() => updateDraft(i, { file_path: "", file_size_bytes: null })}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove (use base product file)
                    </button>
                  </div>
                ) : (
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-mute hover:text-ink">
                    <Upload size={14} />
                    <span>
                      {d.uploading ? "Uploading…" : "Upload variant file (optional — falls back to product's base file)"}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      disabled={d.uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadFile(i, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={d.is_active}
                  onChange={(e) => updateDraft(i, { is_active: e.target.checked })}
                  className="h-4 w-4 accent-gold"
                />
                Active (buyers can select this variant)
              </label>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addVariant}
            className="inline-flex items-center gap-2 rounded-full border-2 border-navy px-5 py-2.5 text-sm font-bold text-navy hover:bg-navy hover:text-white"
          >
            <Plus size={14} /> Add variant
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-navy shadow-gold-glow disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Save all variants
          </button>
        </div>
      </div>
    </PublisherShell>
  );
}
