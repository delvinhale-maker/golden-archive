import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  fetchAffiliateProducts,
  fetchAffiliateClickCounts,
  AFFILIATE_CATEGORIES,
  type AffiliateProduct,
  type AffiliateSource,
} from "@/lib/affiliate";
import { Crown, Plus, Pencil, Trash2, ExternalLink, ShieldAlert, RefreshCw, Clock, Upload, Loader2, Save } from "lucide-react";

const DRAFT_KEY = "kingdom-picks:new-draft";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/kingdom-picks")({
  component: KingdomPicksAdminPage,
});

type FormState = {
  id?: string;
  title: string;
  description: string;
  price: string;
  original_price: string;
  image_url: string;
  affiliate_url: string;
  source: AffiliateSource;
  category: string;
  badge: string;
  featured: boolean;
  active: boolean;
};

const EMPTY: FormState = {
  title: "",
  description: "",
  price: "",
  original_price: "",
  image_url: "",
  affiliate_url: "",
  source: "amazon",
  category: "eBooks",
  badge: "",
  featured: false,
  active: true,
};

function KingdomPicksAdminPage() {
  const { isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<AffiliateProduct[]>([]);
  const [clicks, setClicks] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [refreshingClicks, setRefreshingClicks] = useState(false);
  const [clicksUpdatedAt, setClicksUpdatedAt] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tab, setTab] = useState<"all" | "deals">("all");
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function handleFileUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("kingdom-picks")
        .upload(path, file, { cacheControl: "31536000", contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("kingdom-picks").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function refreshClicks(showToast = false) {
    setRefreshingClicks(true);
    try {
      const counts = await fetchAffiliateClickCounts();
      setClicks(counts);
      setClicksUpdatedAt(new Date());
      if (showToast) toast.success("Click counts refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to refresh clicks");
    } finally {
      setRefreshingClicks(false);
    }
  }

  async function refresh() {
    const [products, counts] = await Promise.all([
      fetchAffiliateProducts({ activeOnly: false, featuredFirst: true }),
      fetchAffiliateClickCounts(),
    ]);
    setRows(products);
    setClicks(counts);
    setClicksUpdatedAt(new Date());
  }

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoRefresh && isAdmin) {
      timerRef.current = setInterval(() => {
        refreshClicks(false);
      }, Math.max(5, autoRefreshSeconds) * 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefresh, autoRefreshSeconds, isAdmin]);

  if (loading) return null;
  if (!isAdmin) {
    return (
      <PublisherShell accent={ACCENTS.bookshelf}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 flex items-start gap-3">
          <ShieldAlert className="shrink-0 mt-0.5" />
          <div>
            <p className="font-display text-lg">Admins only</p>
            <p className="text-sm mt-1">
              Managing Kingdom Picks is restricted to AurumVault admins.{" "}
              <Link to="/kingdom-picks" className="underline">View the public Kingdom Picks page →</Link>
            </p>
          </div>
        </div>
      </PublisherShell>
    );
  }

  async function toggle(id: string, field: "featured" | "active", value: boolean) {
    const patch: { featured?: boolean; active?: boolean } =
      field === "featured" ? { featured: value } : { active: value };
    const { error } = await supabase.from("affiliate_products").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this Kingdom Pick? This cannot be undone.")) return;
    const { error } = await supabase.from("affiliate_products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Deleted");
  }

  async function setDeal(id: string, active: boolean) {
    const expires = active ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
    const patch = { deal_active: active, deal_expires_at: expires };
    const { error } = await supabase.from("affiliate_products").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    toast.success(active ? "Marked as Deal of the Day (24h)" : "Removed from Deals");
  }

  function startCreate() {
    let initial: FormState = EMPTY;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { form: FormState; savedAt: string };
        if (parsed?.form) {
          initial = { ...EMPTY, ...parsed.form, id: undefined };
          setDraftSavedAt(new Date(parsed.savedAt));
          toast.info("Draft restored — continue where you left off");
        }
      }
    } catch {}
    setForm(initial);
    setOpen(true);
  }

  function saveDraft() {
    try {
      const now = new Date();
      const { id: _id, ...rest } = form;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form: rest, savedAt: now.toISOString() }));
      setDraftSavedAt(now);
      toast.success("Progress saved");
    } catch (e) {
      toast.error("Couldn't save draft");
    }
  }

  function discardDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setDraftSavedAt(null);
  }
  function startEdit(p: AffiliateProduct) {
    setForm({
      id: p.id,
      title: p.title,
      description: p.description ?? "",
      price: String(p.price),
      original_price: p.original_price != null ? String(p.original_price) : "",
      image_url: p.image_url,
      affiliate_url: p.affiliate_url,
      source: p.source,
      category: p.category,
      badge: p.badge ?? "",
      featured: p.featured,
      active: p.active,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.image_url.trim()) return toast.error("Image URL is required");
    if (!form.affiliate_url.trim()) return toast.error("Affiliate URL is required");
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) return toast.error("Invalid price");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      price: priceNum,
      original_price: form.original_price ? Number(form.original_price) : null,
      image_url: form.image_url.trim(),
      affiliate_url: form.affiliate_url.trim(),
      source: form.source,
      category: form.category,
      badge: form.badge.trim() || null,
      featured: form.featured,
      active: form.active,
    };

    setBusy(true);
    const { error } = form.id
      ? await supabase.from("affiliate_products").update(payload).eq("id", form.id)
      : await supabase.from("affiliate_products").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Updated" : "Kingdom Pick added");
    if (!form.id) discardDraft();
    setOpen(false);
    refresh();
  }

  return (
    <PublisherShell accent={ACCENTS.bookshelf}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-caps text-gold-ink">
            <Crown size={12} /> AFFILIATE PARTNERS
          </div>
          <h1 className="mt-1 font-display text-3xl md:text-4xl text-navy">Kingdom Picks</h1>
          <p className="mt-1 text-mute text-sm">Curate Amazon &amp; Walmart partner products and track click-through performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshClicks(true)}
            disabled={refreshingClicks}
            className="inline-flex items-center gap-2 rounded-full border border-navy/20 px-4 py-2.5 text-sm font-medium text-navy hover:bg-navy/5 disabled:opacity-60"
            aria-label="Refresh click counts"
            title={clicksUpdatedAt ? `Last updated ${clicksUpdatedAt.toLocaleTimeString()}` : "Refresh click counts"}
          >
            <RefreshCw size={14} className={refreshingClicks ? "animate-spin" : ""} />
            {refreshingClicks ? "Refreshing…" : "Refresh clicks"}
          </button>
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-full font-semibold px-5 py-2.5 text-white shadow-md hover:shadow-lg"
            style={{ background: "var(--page-accent)" }}
          >
            <Plus size={16} /> Add Kingdom Pick
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-mute">
        {clicksUpdatedAt && (
          <span>Click counts updated {clicksUpdatedAt.toLocaleTimeString()}</span>
        )}
        <div className="flex items-center gap-2 rounded-full border border-navy/10 bg-white px-3 py-1.5">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`inline-flex items-center gap-1.5 transition ${autoRefresh ? "text-gold-ink" : "text-mute"}`}
            aria-pressed={autoRefresh}
            aria-label="Toggle auto-refresh"
          >
            <Clock size={12} className={autoRefresh ? "animate-pulse" : ""} />
            <span className="font-semibold">Auto-refresh</span>
            <span className={`ml-1 h-2 w-2 rounded-full ${autoRefresh ? "bg-green-500" : "bg-ink/20"}`} />
          </button>
          <select
            value={autoRefreshSeconds}
            onChange={(e) => setAutoRefreshSeconds(Number(e.target.value))}
            disabled={!autoRefresh}
            className="bg-transparent text-[11px] font-medium text-navy disabled:opacity-50"
            aria-label="Auto-refresh interval"
          >
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>1m</option>
            <option value={300}>5m</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 border-b border-ink/10">
        {(["all", "deals"] as const).map((t) => {
          const activeCount = rows.filter(
            (r) =>
              r.deal_active &&
              (!r.deal_expires_at || new Date(r.deal_expires_at).getTime() > nowTick),
          ).length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === t
                  ? "border-gold text-navy"
                  : "border-transparent text-mute hover:text-navy"
              }`}
              aria-pressed={tab === t}
            >
              {t === "all" ? "All Picks" : "Deals of the Day"}
              {t === "deals" && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {activeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(() => {
        const visibleRows =
          tab === "deals"
            ? rows.filter(
                (r) =>
                  r.deal_active &&
                  (!r.deal_expires_at || new Date(r.deal_expires_at).getTime() > nowTick),
              )
            : rows;
        return (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-[11px] uppercase tracking-wider text-mute">
                <tr>
                  <th className="p-3">Image</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">
                    <span className="inline-flex items-center gap-1">
                      Clicks
                      {refreshingClicks && <RefreshCw size={10} className="animate-spin text-gold-ink" />}
                    </span>
                  </th>
                  <th className="p-3">Featured</th>
                  <th className="p-3">Active</th>
                  <th className="p-3">Deal</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-mute">
                      {tab === "deals"
                        ? "No active Deals of the Day. Toggle one from All Picks to feature it."
                        : "No Kingdom Picks yet — click \"Add Kingdom Pick\" to seed one."}
                    </td>
                  </tr>
                )}
                {visibleRows.map((p) => {
                  const dealLive =
                    p.deal_active &&
                    (!p.deal_expires_at || new Date(p.deal_expires_at).getTime() > nowTick);
                  const remainingMs = p.deal_expires_at
                    ? Math.max(0, new Date(p.deal_expires_at).getTime() - nowTick)
                    : 0;
                  const rh = Math.floor(remainingMs / 3_600_000);
                  const rm = Math.floor((remainingMs % 3_600_000) / 60_000);
                  const rs = Math.floor((remainingMs % 60_000) / 1000);
                  const priceNum = Number(p.price);
                  const origNum = p.original_price != null ? Number(p.original_price) : null;
                  return (
                    <tr key={p.id} className="border-t border-ink/5 align-middle">
                      <td className="p-3">
                        <img src={p.image_url} alt="" className="h-12 w-12 rounded object-cover bg-paper" />
                      </td>
                      <td className="p-3 max-w-xs">
                        <p className="font-medium text-navy line-clamp-1">{p.title}</p>
                        <a href={p.affiliate_url} target="_blank" rel="nofollow sponsored noopener" className="text-[11px] text-mute hover:text-gold-ink inline-flex items-center gap-1">
                          Test link <ExternalLink size={10} />
                        </a>
                      </td>
                      <td className="p-3 capitalize">{p.source}</td>
                      <td className="p-3">{p.category}</td>
                      <td className="p-3">
                        <div className="font-semibold text-navy">${priceNum.toFixed(2)}</div>
                        {origNum != null && origNum > priceNum && (
                          <div className="text-[11px] text-mute line-through">${origNum.toFixed(2)}</div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-navy">{clicks[p.id] ?? 0}</td>
                      <td className="p-3">
                        <Toggle on={p.featured} onChange={(v) => toggle(p.id, "featured", v)} />
                      </td>
                      <td className="p-3">
                        <Toggle on={p.active} onChange={(v) => toggle(p.id, "active", v)} />
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => setDeal(p.id, !dealLive)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              dealLive ? "bg-red-600 text-white hover:bg-red-700" : "border border-navy/20 text-navy hover:bg-navy/5"
                            }`}
                          >
                            <Clock size={10} />
                            {dealLive ? "Stop deal" : "Start 24h deal"}
                          </button>
                          {dealLive && (
                            <span className="font-mono text-[10px] text-mute">
                              {String(rh).padStart(2, "0")}:{String(rm).padStart(2, "0")}:{String(rs).padStart(2, "0")} left
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button onClick={() => startEdit(p)} className="inline-flex items-center gap-1 rounded-full border border-navy/20 px-2.5 py-1 text-xs hover:bg-navy/5">
                          <Pencil size={12} /> Edit
                        </button>
                        <button onClick={() => remove(p.id)} className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-xs text-white hover:bg-red-700">
                          <Trash2 size={12} /> Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl text-navy">{form.id ? "Edit Kingdom Pick" : "Add Kingdom Pick"}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Title" className="col-span-2">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
              </Field>
              <Field label="Description" className="col-span-2">
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="input" />
              </Field>
              <Field label="Price ($)">
                <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input" />
              </Field>
              <Field label="Original Price (optional)">
                <input type="number" step="0.01" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} className="input" />
              </Field>
              <Field label="Product Image" className="col-span-2">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    {form.image_url ? (
                      <img src={form.image_url} alt="" className="h-16 w-16 rounded-md border border-ink/10 object-cover bg-paper" />
                    ) : (
                      <div className="h-16 w-16 rounded-md border border-dashed border-ink/20 bg-paper" />
                    )}
                    <div className="flex flex-col gap-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(f);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="inline-flex items-center gap-2 rounded-full border border-navy/20 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5 disabled:opacity-50"
                      >
                        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        {uploading ? "Uploading…" : form.image_url ? "Replace image" : "Upload image"}
                      </button>
                      <span className="text-[10px] text-mute">JPG/PNG/WebP · max 5 MB</span>
                    </div>
                  </div>
                  <input
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="…or paste an image URL"
                    className="input"
                  />
                </div>
              </Field>
              <Field label="Affiliate URL" className="col-span-2">
                <input value={form.affiliate_url} onChange={(e) => setForm({ ...form, affiliate_url: e.target.value })} placeholder="https://www.amazon.com/dp/…?tag=…" className="input" />
              </Field>
              <Field label="Source">
                <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as AffiliateSource })} className="input">
                  <option value="amazon">Amazon</option>
                  <option value="walmart">Walmart</option>
                </select>
              </Field>
              <Field label="Category">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                  {AFFILIATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Badge (optional)" className="col-span-2">
                <input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="Bestseller, Kingdom Pick, Staff Favorite…" className="input" />
              </Field>
              <label className="col-span-1 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
                Featured
              </label>
              <label className="col-span-1 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Active
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-mute">
                {!form.id && draftSavedAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Draft saved {draftSavedAt.toLocaleTimeString()}
                    <button
                      type="button"
                      onClick={() => { discardDraft(); toast.success("Draft discarded"); }}
                      className="ml-2 underline hover:text-navy"
                    >
                      Discard
                    </button>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm text-mute hover:bg-paper">Cancel</button>
                {!form.id && (
                  <button
                    type="button"
                    onClick={saveDraft}
                    className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 px-4 py-2 text-sm font-semibold text-navy hover:bg-navy/5"
                  >
                    <Save size={14} /> Save progress
                  </button>
                )}
                <button disabled={busy} onClick={save} className="rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--page-accent)" }}>
                  {busy ? "Saving…" : form.id ? "Save changes" : "Add Pick"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`.input{width:100%;border:1px solid rgba(15,30,53,.15);border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem;background:#fff}.input:focus{outline:none;border-color:var(--accent-color)}`}</style>
    </PublisherShell>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 rounded-full transition ${on ? "bg-gold" : "bg-ink/20"}`}
      aria-pressed={on}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${on ? "left-4" : "left-0.5"}`} />
    </button>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-caps text-mute">{label}</span>
      {children}
    </label>
  );
}
