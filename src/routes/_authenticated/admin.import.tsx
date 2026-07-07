import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Sparkles, Plus, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  previewAffiliateProduct,
  previewAffiliateProductsBulk,
  saveAffiliateProduct,
  type AffiliatePreview,
} from "@/lib/affiliate-import.functions";
import { AFFILIATE_CATEGORIES } from "@/lib/affiliate";

export const Route = createFileRoute("/_authenticated/admin/import")({
  component: ImportPage,
});

type EditablePreview = AffiliatePreview & {
  category: string;
  description: string;
  featured: boolean;
  badge: string;
  saving?: boolean;
  saved?: boolean;
};

function toEditable(p: AffiliatePreview): EditablePreview {
  return {
    ...p,
    category: "eBooks",
    description: "",
    featured: false,
    badge: "",
  };
}

function ImportPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const runPreview = useServerFn(previewAffiliateProduct);
  const runBulk = useServerFn(previewAffiliateProductsBulk);
  const runSave = useServerFn(saveAffiliateProduct);

  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [input, setInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [previews, setPreviews] = useState<EditablePreview[]>([]);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const allowed = data?.role === "admin";
        setIsAdmin(allowed);
        setCheckingAdmin(false);
        if (!allowed) navigate({ to: "/dashboard" });
      });
    return () => { active = false; };
  }, [loading, user, navigate]);

  async function doSinglePreview() {
    if (!input.trim()) return;
    setPreviewing(true);
    try {
      const p = await runPreview({ data: { input: input.trim() } });
      setPreviews((prev) => [toEditable(p), ...prev]);
      setInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function doBulkPreview() {
    const lines = bulkInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setPreviewing(true);
    try {
      const results = await runBulk({ data: { inputs: lines } });
      const ok = results.filter((r) => r.ok && r.preview).map((r) => toEditable(r.preview!));
      const failed = results.filter((r) => !r.ok);
      if (ok.length) setPreviews((prev) => [...ok, ...prev]);
      if (failed.length) toast.error(`${failed.length} failed to fetch — see console`);
      if (failed.length) console.warn("[import] failed lines", failed);
      if (ok.length) toast.success(`Fetched ${ok.length} previews`);
      setBulkInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  function updatePreview(asin: string, patch: Partial<EditablePreview>) {
    setPreviews((prev) => prev.map((p) => (p.asin === asin ? { ...p, ...patch } : p)));
  }
  function removePreview(asin: string) {
    setPreviews((prev) => prev.filter((p) => p.asin !== asin));
  }

  async function saveOne(p: EditablePreview) {
    if (!p.title.trim() || !p.imageUrl || !(Number(p.price) >= 0)) {
      toast.error("Title, image, and non-negative price required");
      return;
    }
    updatePreview(p.asin, { saving: true });
    try {
      await runSave({
        data: {
          asin: p.asin,
          title: p.title.trim(),
          price: Number(p.price ?? 0),
          imageUrl: p.imageUrl,
          affiliateUrl: p.affiliateUrl,
          category: p.category,
          description: p.description,
          featured: p.featured,
          badge: p.badge.trim() || null,
        },
      });
      updatePreview(p.asin, { saving: false, saved: true });
      toast.success(`Added: ${p.title}`);
    } catch (err) {
      updatePreview(p.asin, { saving: false });
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function saveAll() {
    const pending = previews.filter((p) => !p.saved);
    for (const p of pending) {
      // eslint-disable-next-line no-await-in-loop
      await saveOne(p);
    }
  }

  if (loading || checkingAdmin) return null;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#08101D] text-white">
      <header className="border-b border-white/10 bg-[#0B1626]">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-gold">
            <ArrowLeft size={16} /> Admin
          </Link>
          <div className="ml-2 h-5 w-px bg-white/15" />
          <h1 className="font-display text-xl font-bold text-white">
            <span className="text-gold">Kingdom Picks</span> Importer
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 inline-flex rounded-full border border-white/15 bg-white/5 p-1">
          {(["single", "bulk"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                mode === m ? "bg-gold text-navy" : "text-white/70 hover:text-white"
              }`}
            >
              {m === "single" ? "Single" : "Bulk paste"}
            </button>
          ))}
        </div>

        {mode === "single" ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <label className="mb-2 block text-xs font-bold uppercase tracking-caps text-white/60">
              ASIN or Amazon URL
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="B08N5WRWNW  or  https://www.amazon.com/dp/B08N5WRWNW"
                className="flex-1 rounded-full border border-white/15 bg-[#0B1626] px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-gold focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && doSinglePreview()}
              />
              <button
                onClick={doSinglePreview}
                disabled={previewing || !input.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy transition hover:brightness-105 disabled:opacity-50"
              >
                {previewing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Preview
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <label className="mb-2 block text-xs font-bold uppercase tracking-caps text-white/60">
              One ASIN or URL per line (max 50)
            </label>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              rows={8}
              placeholder={"B08N5WRWNW\nhttps://www.amazon.com/dp/B0CRDCVQK1\n..."}
              className="w-full rounded-2xl border border-white/15 bg-[#0B1626] px-4 py-3 font-mono text-sm text-white placeholder-white/30 focus:border-gold focus:outline-none"
            />
            <button
              onClick={doBulkPreview}
              disabled={previewing || !bulkInput.trim()}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy transition hover:brightness-105 disabled:opacity-50"
            >
              {previewing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Fetch previews
            </button>
          </div>
        )}

        {previews.length > 0 && (
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">
                Previews <span className="text-white/50">({previews.length})</span>
              </h2>
              <button
                onClick={saveAll}
                disabled={previews.every((p) => p.saved)}
                className="inline-flex items-center gap-2 rounded-full border border-gold px-4 py-2 text-xs font-bold text-gold hover:bg-gold hover:text-navy disabled:opacity-40"
              >
                <Plus size={14} /> Add all to store
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {previews.map((p) => (
                <article
                  key={p.asin}
                  className={`flex gap-4 rounded-2xl border p-4 transition ${
                    p.saved
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="h-32 w-24 shrink-0 overflow-hidden rounded-lg bg-[#0B1626]">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">
                        {p.asin}
                      </span>
                      <button
                        onClick={() => removePreview(p.asin)}
                        className="text-white/40 hover:text-red-400"
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input
                      value={p.title}
                      onChange={(e) => updatePreview(p.asin, { title: e.target.value })}
                      disabled={p.saved}
                      className="rounded-md border border-white/15 bg-[#0B1626] px-2 py-1.5 text-sm text-white focus:border-gold focus:outline-none disabled:opacity-70"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] uppercase tracking-caps text-white/40">Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={p.price ?? 0}
                          onChange={(e) => updatePreview(p.asin, { price: Number(e.target.value) })}
                          disabled={p.saved}
                          className="w-full rounded-md border border-white/15 bg-[#0B1626] px-2 py-1.5 text-sm text-white focus:border-gold focus:outline-none disabled:opacity-70"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] uppercase tracking-caps text-white/40">Category</label>
                        <select
                          value={p.category}
                          onChange={(e) => updatePreview(p.asin, { category: e.target.value })}
                          disabled={p.saved}
                          className="w-full rounded-md border border-white/15 bg-[#0B1626] px-2 py-1.5 text-sm text-white focus:border-gold focus:outline-none disabled:opacity-70"
                        >
                          {AFFILIATE_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <input
                      value={p.badge}
                      onChange={(e) => updatePreview(p.asin, { badge: e.target.value })}
                      placeholder="Badge (optional, e.g. Bestseller)"
                      disabled={p.saved}
                      className="rounded-md border border-white/15 bg-[#0B1626] px-2 py-1.5 text-xs text-white focus:border-gold focus:outline-none disabled:opacity-70"
                    />
                    <textarea
                      value={p.description}
                      onChange={(e) => updatePreview(p.asin, { description: e.target.value })}
                      placeholder="Short description (optional)"
                      rows={2}
                      disabled={p.saved}
                      className="rounded-md border border-white/15 bg-[#0B1626] px-2 py-1.5 text-xs text-white focus:border-gold focus:outline-none disabled:opacity-70"
                    />
                    <label className="flex items-center gap-2 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={p.featured}
                        onChange={(e) => updatePreview(p.asin, { featured: e.target.checked })}
                        disabled={p.saved}
                      />
                      Feature on homepage
                    </label>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <a
                        href={p.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-gold hover:underline"
                      >
                        Open affiliate link <ExternalLink size={11} />
                      </a>
                      <button
                        onClick={() => saveOne(p)}
                        disabled={p.saving || p.saved}
                        className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-navy hover:brightness-105 disabled:opacity-50"
                      >
                        {p.saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        {p.saved ? "Added" : "Add to store"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
