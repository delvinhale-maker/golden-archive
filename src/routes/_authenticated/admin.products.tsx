import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { ArrowLeft, ShieldCheck, Pencil, CheckCircle2, XCircle, Search, Save, X, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { ProductPreviewsManager } from "@/components/admin/ProductPreviewsManager";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: AdminProductsPage,
});

type Category = "ebooks" | "courses" | "templates" | "audio" | "leadership";
type Status = "pending" | "approved" | "rejected";
type Prod = {
  id: string;
  title: string;
  description: string;
  category: Category;
  price_cents: number;
  creator_name: string | null;
  cover_url: string | null;
  status: Status;
  created_at: string;
  file_path: string | null;
  seller_id: string;
};

const CATEGORIES: Category[] = ["ebooks", "courses", "templates", "audio", "leadership"];
const STATUSES: Status[] = ["pending", "approved", "rejected"];

function AdminProductsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [items, setItems] = useState<Prod[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Prod | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => {
        const ok = data?.role === "admin";
        setIsAdmin(ok); setChecking(false);
        if (!ok) navigate({ to: "/dashboard" });
      });
  }, [loading, user, navigate]);

  async function refresh() {
    const { data } = await supabase.from("marketplace_products")
      .select("id,title,description,category,price_cents,creator_name,cover_url,status,created_at,file_path,seller_id")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Prod[]);
  }
  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  const visible = useMemo(() => items.filter(p =>
    (filter === "all" || p.status === filter) &&
    (!q || p.title.toLowerCase().includes(q.toLowerCase()) || (p.creator_name ?? "").toLowerCase().includes(q.toLowerCase()))
  ), [items, filter, q]);

  async function setStatus(p: Prod, status: Status) {
    const patch: {
      status: Status;
      approved_at?: string;
      rejected_reason?: string;
      published?: boolean;
    } = { status };
    if (status === "approved") {
      patch.approved_at = new Date().toISOString();
      patch.published = true;
    }
    if (status === "rejected") {
      const reason = window.prompt("Reason for rejection:", "Does not meet our quality guidelines.");
      if (!reason) return;
      patch.rejected_reason = reason;
      patch.published = false;
    }
    const { error } = await supabase.from("marketplace_products").update(patch).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`"${p.title}" → ${status}`);
    refresh();
  }

  async function releaseStaleNow() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const stale = items.filter((p) => p.status === "pending" && p.created_at < cutoff);
    if (stale.length === 0) {
      toast.info("No pending products older than 24h.");
      return;
    }
    if (!window.confirm(`Auto-release ${stale.length} pending product(s) older than 24h?`)) return;
    const { error } = await supabase
      .from("marketplace_products")
      .update({ status: "approved", published: true, approved_at: new Date().toISOString() })
      .in("id", stale.map((p) => p.id));
    if (error) return toast.error(error.message);
    toast.success(`Released ${stale.length} product(s).`);
    refresh();
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("marketplace_products").update({
      title: editing.title.trim(),
      description: editing.description,
      category: editing.category,
      price_cents: Math.max(0, Math.round(Number(editing.price_cents))),
      creator_name: editing.creator_name?.trim() || null,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Product updated");
    setEditing(null);
    refresh();
  }

  if (loading || checking) return null;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center gap-4">
          <Link to="/"><AVLogo /></Link>
          <span className="inline-flex items-center gap-1.5 text-sm rounded-full bg-gold/15 text-gold px-3 py-1">
            <ShieldCheck size={14} /> Admin · Products
          </span>
          <Link to="/admin" className="ml-auto text-sm text-white/70 hover:text-white inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Approval queue
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 md:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-3xl md:text-4xl text-navy">All products</h1>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-mute" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or creator"
                className="pl-8 pr-3 h-9 rounded-md border border-ink/15 bg-white text-sm w-64" />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}
              className="h-9 rounded-md border border-ink/15 bg-white text-sm px-2">
              <option value="all">All ({items.length})</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={releaseStaleNow}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-gold text-navy text-sm font-medium hover:bg-gold/90"
              title="Approve & publish any pending product older than 24h"
            >
              <CheckCircle2 size={14} /> Release stale (24h)
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-navy">
          <strong className="font-semibold">Auto-release:</strong> pending products are automatically approved and published 24 hours after submission. Use <em>Reject</em> before then to block a listing, or click <em>Release stale</em> to run the audit now.
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center text-mute">No products.</div>
        ) : (
          <div className="grid gap-3">
            {visible.map((p) => (
              <div key={p.id} className="bg-white border border-ink/10 rounded-2xl p-4 flex gap-4">
                <div className="w-20 h-28 shrink-0 rounded-md bg-gradient-to-br from-navy to-[#22335A]"
                  style={p.cover_url ? { backgroundImage: `url(${p.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] uppercase tracking-wider text-mute">{p.category}</p>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="font-display text-xl text-navy truncate">{p.title}</p>
                  <p className="text-xs text-mute">{p.creator_name ?? "—"}</p>
                  <p className="text-sm text-ink/80 mt-1 line-clamp-2">{p.description}</p>
                  <p className="text-gold font-medium mt-1">${(p.price_cents / 100).toFixed(2)}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setEditing(p)}
                    className="inline-flex items-center gap-1 text-sm rounded-full bg-navy text-white px-3 py-1.5 hover:bg-navy/90">
                    <Pencil size={14} /> Edit
                  </button>
                  {p.status !== "approved" && (
                    <button onClick={() => setStatus(p, "approved")}
                      className="inline-flex items-center gap-1 text-sm rounded-full bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-700">
                      <CheckCircle2 size={14} /> Approve
                    </button>
                  )}
                  {p.status !== "rejected" && (
                    <button onClick={() => setStatus(p, "rejected")}
                      className="inline-flex items-center gap-1 text-sm rounded-full bg-red-600 text-white px-3 py-1.5 hover:bg-red-700">
                      <XCircle size={14} /> {p.status === "approved" ? "Unpublish" : "Reject"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-ink/10">
              <h2 className="font-display text-2xl text-navy">Edit product</h2>
              <button onClick={() => setEditing(null)} className="text-mute hover:text-navy"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Title">
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full h-10 rounded-md border border-ink/15 px-3" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Category">
                  <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as Category })}
                    className="w-full h-10 rounded-md border border-ink/15 px-2 bg-white capitalize">
                    {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </Field>
                <Field label="Price (USD)">
                  <input type="number" step="0.01" min="0"
                    value={(editing.price_cents / 100).toFixed(2)}
                    onChange={(e) => setEditing({ ...editing, price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                    className="w-full h-10 rounded-md border border-ink/15 px-3" />
                </Field>
              </div>
              <Field label="Creator">
                <input value={editing.creator_name ?? ""} onChange={(e) => setEditing({ ...editing, creator_name: e.target.value })}
                  className="w-full h-10 rounded-md border border-ink/15 px-3" />
              </Field>
              <Field label="Product file (PDF, EPUB, DOCX)">
                <ProductFileUpload
                  product={editing}
                  onUpdated={(newPath) => {
                    setEditing({ ...editing, file_path: newPath });
                    refresh();
                  }}
                />
              </Field>
              <Field label="Description">
                <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={6} className="w-full rounded-md border border-ink/15 p-3" />
              </Field>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-ink/10">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm rounded-md border border-ink/15 hover:bg-ink/5">Cancel</button>
              <button onClick={saveEdit} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-gold text-navy font-medium hover:bg-gold/90 disabled:opacity-50">
                <Save size={14} /> {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-navy uppercase tracking-wider">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-800 border-amber-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${map[status] ?? "bg-ink/5 text-mute"}`}>{status}</span>;
}

function ProductFileUpload({ product, onUpdated }: { product: Prod; onUpdated: (newPath: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const currentName = product.file_path ? product.file_path.split("/").pop() ?? product.file_path : null;

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!(lower.endsWith(".pdf") || lower.endsWith(".epub") || lower.endsWith(".docx"))) {
      toast.error("File must be PDF, EPUB, or DOCX.");
      return;
    }
    if (f.size > 500 * 1024 * 1024) {
      toast.error("File must be under 500 MB.");
      return;
    }
    setUploading(true);
    try {
      const path = `${product.seller_id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const up = await supabase.storage.from("product-files").upload(path, f, { upsert: false });
      if (up.error) throw up.error;
      const { error } = await supabase.from("marketplace_products")
        .update({ file_path: path, file_size_bytes: f.size })
        .eq("id", product.id);
      if (error) throw error;
      toast.success(`Uploaded: ${f.name}`);
      onUpdated(path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {currentName ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <FileText size={16} className="text-emerald-700 shrink-0" />
          <span className="text-emerald-900 truncate flex-1">{currentName}</span>
          <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
        </div>
      ) : (
        <p className="text-xs text-mute">No file attached yet.</p>
      )}
      <label className="inline-flex items-center gap-2 text-sm rounded-md border border-ink/15 bg-white px-3 py-2 cursor-pointer hover:bg-ink/5">
        <Upload size={14} />
        {uploading ? "Uploading…" : currentName ? "Replace file" : "Upload file"}
        <input type="file" accept=".pdf,.epub,.docx" className="hidden" onChange={handle} disabled={uploading} />
      </label>
    </div>
  );
}
