import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  BookOpen,
  Plus,
  ExternalLink,
  Pencil,
  EyeOff,
  Eye,
  Trash2,
  Hourglass,
  XCircle,
  Search,
  MoreVertical,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: BookshelfPage,
});

type Application = { id: string; status: string };
type Product = {
  id: string;
  title: string;
  status: string;
  published: boolean;
  cover_url: string | null;
  file_path: string | null;
  created_at: string;
  price_cents: number;
  category: string;
  rejected_reason: string | null;
};

type ConfirmKind = "unpublish" | "republish" | "delete1" | "delete2";

type Stat = { units: number; earnings_cents: number };
type FilterKey = "all" | "live" | "drafts" | "unpublished";
type SortKey = "date" | "title" | "status" | "price";

function BookshelfPage() {
  const { user, isSeller, isAdmin } = useAuth();
  const [app, setApp] = useState<Application | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [confirmState, setConfirmState] = useState<
    { kind: ConfirmKind; product: Product } | null
  >(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: a }, { data: p }, { data: items }] = await Promise.all([
        supabase
          .from("seller_applications")
          .select("id,status")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("marketplace_products")
          .select(
            "id,title,status,published,cover_url,file_path,created_at,price_cents,category,rejected_reason",
          )
          .eq("seller_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("order_items")
          .select("product_id,seller_amount_cents,orders!inner(status)")
          .eq("seller_id", user.id)
          .eq("orders.status", "paid"),
      ]);
      setApp(a as Application | null);
      setProducts((p ?? []) as Product[]);
      const map: Record<string, Stat> = {};
      for (const it of (items ?? []) as {
        product_id: string;
        seller_amount_cents: number;
      }[]) {
        const cur = map[it.product_id] ?? { units: 0, earnings_cents: 0 };
        cur.units += 1;
        cur.earnings_cents += it.seller_amount_cents ?? 0;
        map[it.product_id] = cur;
      }
      setStats(map);
      setLoading(false);
    })();
  }, [user]);

  const canPublish = isAdmin || isSeller || app?.status === "approved";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q)) return false;
      if (filter === "live") return p.published && p.status === "approved";
      if (filter === "drafts") return p.status === "pending" || (!p.published && p.status !== "rejected");
      if (filter === "unpublished") return !p.published && p.status === "approved";
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "price") return b.price_cents - a.price_cents;
      if (sort === "status") return statusRank(a) - statusRank(b);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [products, query, filter, sort]);

  const counts = useMemo(() => {
    const c = { all: products.length, live: 0, drafts: 0, unpublished: 0 };
    for (const p of products) {
      if (p.published && p.status === "approved") c.live++;
      else if (p.status === "pending" || (!p.published && p.status !== "rejected")) c.drafts++;
      if (!p.published && p.status === "approved") c.unpublished++;
    }
    return c;
  }, [products]);

  async function unpublish(product: Product) {
    setBusyId(product.id);
    const { error } = await supabase
      .from("marketplace_products")
      .update({ published: false })
      .eq("id", product.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, published: false } : p)));
    toast.success(`${product.title} has been unpublished. You can republish from your Bookshelf.`);
  }

  async function republish(product: Product) {
    if (product.status !== "approved") {
      return toast.error("Only approved titles can be republished.");
    }
    setBusyId(product.id);
    const { error } = await supabase
      .from("marketplace_products")
      .update({ published: true })
      .eq("id", product.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, published: true } : p)));
    toast.success(`${product.title} is live again on AurumVault!`);
  }

  function extractCoverPath(url: string | null): string | null {
    if (!url) return null;
    const m = url.match(/\/product-covers\/([^?]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function remove(product: Product) {
    setBusyId(product.id);
    const { error } = await supabase.from("marketplace_products").delete().eq("id", product.id);
    if (error) {
      setBusyId(null);
      return toast.error(
        /foreign key|violat/i.test(error.message)
          ? "Can't delete: this title has existing orders. Unpublish it instead."
          : error.message,
      );
    }
    // Best-effort storage cleanup — don't block the UI on failures
    const coverPath = extractCoverPath(product.cover_url);
    const removals: Promise<unknown>[] = [];
    if (coverPath) removals.push(supabase.storage.from("product-covers").remove([coverPath]));
    if (product.file_path)
      removals.push(supabase.storage.from("product-files").remove([product.file_path]));
    await Promise.allSettled(removals);
    setBusyId(null);
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    toast.success(`${product.title} has been permanently deleted.`);
  }

  function requestConfirm(kind: ConfirmKind, id: string) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setConfirmState({ kind, product });
  }

  async function handleConfirm() {
    if (!confirmState) return;
    const { kind, product } = confirmState;
    if (kind === "delete1") {
      setConfirmState({ kind: "delete2", product });
      return;
    }
    setConfirmState(null);
    if (kind === "unpublish") await unpublish(product);
    else if (kind === "republish") await republish(product);
    else if (kind === "delete2") await remove(product);
  }

  return (
    <PublisherShell accent={ACCENTS.bookshelf}>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-navy">Your Bookshelf</h1>
          <p className="mt-1 text-mute">Manage your published and draft titles.</p>
        </div>
        {canPublish && (
          <Link
            to="/dashboard/new"
            className="inline-flex items-center gap-2 rounded-full font-semibold px-5 py-2.5 bg-gold text-navy shadow-md transition-all duration-300 hover:shadow-lg hover:bg-gold/90"
          >
            <Plus size={16} /> Create New Title
          </Link>
        )}
      </div>

      {!loading && !app && !isAdmin && (
        <div className="mt-8 rounded-2xl bg-white border border-ink/10 p-7">
          <h2 className="font-display text-xl text-navy">Become an AurumVault Creator</h2>
          <p className="mt-1 text-sm text-mute">
            Apply once — get reviewed within 48 hours. We keep 9%, you keep 91%.
          </p>
          <Link
            to="/sell"
            className="mt-4 inline-flex rounded-full bg-gold text-navy font-semibold px-5 py-2.5 hover:bg-gold/90"
          >
            Apply to sell
          </Link>
        </div>
      )}
      {!loading && app?.status === "pending" && (
        <div className="mt-8 rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-3">
          <Hourglass className="text-amber-600 shrink-0" />
          <div>
            <p className="font-medium text-amber-900">Application under review</p>
            <p className="text-sm text-amber-800 mt-1">
              Typically within 48 hours — you'll get an email when approved.
            </p>
          </div>
        </div>
      )}
      {!loading && app?.status === "rejected" && (
        <div className="mt-8 rounded-2xl bg-red-50 border border-red-200 p-5 flex items-start gap-3">
          <XCircle className="text-red-600 shrink-0" />
          <p className="text-sm text-red-900">
            Application not approved. Email support@aurumvault.store to reapply.
          </p>
        </div>
      )}

      {/* Controls */}
      {!loading && products.length > 0 && (
        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1 rounded-full bg-white border border-ink/10 p-1 w-fit">
            {(
              [
                ["all", "All Titles", counts.all],
                ["live", "Live", counts.live],
                ["drafts", "Drafts", counts.drafts],
                ["unpublished", "Unpublished", counts.unpublished],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  filter === key
                    ? "bg-navy text-white"
                    : "text-ink/70 hover:text-navy hover:bg-paper"
                }`}
              >
                {label} <span className="opacity-70">({n})</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles…"
                className="pl-9 pr-3 py-2 text-sm rounded-full bg-white border border-ink/10 focus:outline-none focus:ring-2 focus:ring-gold/60 w-56"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="px-3 py-2 text-sm rounded-full bg-white border border-ink/10 focus:outline-none focus:ring-2 focus:ring-gold/60"
            >
              <option value="date">Sort: Date Created</option>
              <option value="title">Sort: Title A–Z</option>
              <option value="status">Sort: Status</option>
              <option value="price">Sort: Price</option>
            </select>
          </div>
        </div>
      )}

      <section className="mt-6">
        {loading ? (
          <div className="text-mute">Loading your bookshelf…</div>
        ) : products.length === 0 ? (
          <EmptyState canPublish={canPublish} />
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center text-mute">
            No titles match your filters.
          </div>
        ) : (
          <BookshelfTable
            products={visible}
            stats={stats}
            busyId={busyId}
            onUnpublish={(id) => requestConfirm("unpublish", id)}
            onRepublish={republish}
            onDelete={(id) => requestConfirm("delete", id)}
          />
        )}
      </section>

      <ConfirmDialog
        state={confirmState}
        onCancel={() => setConfirmState(null)}
        onConfirm={handleConfirm}
      />
    </PublisherShell>
  );
}

function statusRank(p: Product) {
  if (p.published && p.status === "approved") return 0;
  if (p.status === "pending") return 1;
  if (!p.published && p.status === "approved") return 2;
  if (p.status === "rejected") return 3;
  return 4;
}

function EmptyState({ canPublish }: { canPublish: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-12 text-center">
      <BookOpen className="mx-auto text-mute" size={32} />
      <p className="mt-4 font-display text-xl text-navy">
        You haven't published any titles yet.
      </p>
      <p className="mt-1 text-sm text-mute">Click "+ Create New Title" to get started.</p>
      {canPublish && (
        <Link
          to="/dashboard/new"
          className="mt-5 inline-flex items-center gap-2 rounded-full font-semibold px-5 py-2.5 bg-gold text-navy"
        >
          <Plus size={16} /> Create New Title
        </Link>
      )}
    </div>
  );
}

function statusBadge(p: Product) {
  if (p.published && p.status === "approved")
    return { label: "Live", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  if (p.status === "pending")
    return { label: "Under Review", cls: "bg-amber-100 text-amber-800 border-amber-200" };
  if (!p.published && p.status === "approved")
    return { label: "Unpublished", cls: "bg-red-100 text-red-800 border-red-200" };
  if (p.status === "rejected")
    return { label: "Rejected", cls: "bg-red-100 text-red-800 border-red-200" };
  return { label: "Draft", cls: "bg-ink/10 text-ink/70 border-ink/15" };
}

function BookshelfTable({
  products,
  stats,
  busyId,
  onUnpublish,
  onRepublish,
  onDelete,
}: {
  products: Product[];
  stats: Record<string, Stat>;
  busyId: string | null;
  onUnpublish: (id: string) => void;
  onRepublish: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white border border-ink/10">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper border-b border-ink/10 text-xs uppercase tracking-wider text-mute">
            <tr>
              <th className="text-left font-semibold px-4 py-3">Cover</th>
              <th className="text-left font-semibold px-4 py-3">Title</th>
              <th className="text-left font-semibold px-4 py-3">Status</th>
              <th className="text-left font-semibold px-4 py-3">Format</th>
              <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Date</th>
              <th className="text-right font-semibold px-4 py-3 whitespace-nowrap min-w-[96px]">Price</th>
              <th className="text-right font-semibold px-4 py-3 min-w-[72px]">Units</th>
              <th className="text-right font-semibold px-4 py-3 whitespace-nowrap min-w-[112px]">Earnings</th>
              <th className="text-right font-semibold px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const badge = statusBadge(p);
              const isLive = p.published && p.status === "approved";
              const s = stats[p.id] ?? { units: 0, earnings_cents: 0 };
              return (
                <tr
                  key={p.id}
                  className="border-b border-ink/5 last:border-0 hover:bg-paper/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div
                      className="h-14 w-10 rounded shadow-sm bg-gradient-to-br from-navy to-[#22335A] bg-cover bg-center flex items-center justify-center"
                      style={p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : undefined}
                    >
                      {!p.cover_url && <BookOpen size={14} className="text-white/50" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to="/dashboard/edit/$id"
                      params={{ id: p.id }}
                      className="font-display text-navy text-base leading-snug max-w-md hover:underline underline-offset-2"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center text-[11px] font-semibold rounded-full px-2.5 py-1 border ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/80">eBook</td>
                  <td className="px-4 py-3 text-mute whitespace-nowrap">
                    {new Date(p.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-ink">
                    <Money cents={p.price_cents} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink whitespace-nowrap">{s.units}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-gold">
                    <Money cents={s.earnings_cents} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <ActionsMenu
                        productId={p.id}
                        isLive={isLive}
                        canRepublish={!p.published && p.status === "approved"}
                        busy={busyId === p.id}
                        onUnpublish={() => onUnpublish(p.id)}
                        onRepublish={() => onRepublish(p.id)}
                        onDelete={() => onDelete(p.id)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Money({ cents }: { cents: number }) {
  const [whole, frac] = (Math.max(0, cents) / 100).toFixed(2).split(".");
  const formatted = Number(whole).toLocaleString("en-US");
  return (
    <span className="inline-flex items-baseline justify-end tabular-nums leading-none">
      <span className="text-mute mr-0.5 text-[0.85em]">$</span>
      <span>{formatted}</span>
      <span className="text-[0.85em] opacity-70">.{frac}</span>
    </span>
  );
}

function ActionsMenu({
  productId,
  isLive,
  canRepublish,
  busy,
  onUnpublish,
  onRepublish,
  onDelete,
}: {
  productId: string;
  isLive: boolean;
  canRepublish: boolean;
  busy: boolean;
  onUnpublish: () => void;
  onRepublish: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Actions"
        disabled={busy}
        className="p-1.5 rounded-full hover:bg-paper text-ink/70 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={16} />}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 min-w-[180px] rounded-xl bg-white border border-ink/10 shadow-lg py-1.5 text-sm">
          <MenuItem to="/dashboard/edit/$id" params={{ id: productId }} icon={<Pencil size={14} />}>
            Edit
          </MenuItem>
          {isLive && (
            <MenuItem to="/products/$id" params={{ id: productId }} icon={<ExternalLink size={14} />}>
              View in Store
            </MenuItem>
          )}
          {isLive && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onUnpublish();
              }}
              className="w-full text-left px-3 py-2 hover:bg-paper flex items-center gap-2 text-ink"
            >
              <EyeOff size={14} /> Unpublish
            </button>
          )}
          {canRepublish && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRepublish();
              }}
              className="w-full text-left px-3 py-2 hover:bg-paper flex items-center gap-2 text-ink"
            >
              <Eye size={14} /> Republish
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center gap-2 text-red-700"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  to,
  params,
  icon,
  children,
}: {
  to: "/dashboard/edit/$id" | "/products/$id";
  params: { id: string };
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      params={params}
      className="w-full text-left px-3 py-2 hover:bg-paper flex items-center gap-2 text-ink"
    >
      {icon} {children}
    </Link>
  );
}

function ConfirmDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: { kind: "unpublish" | "delete"; product: Product } | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, onCancel]);

  if (!state) return null;
  const isDelete = state.kind === "delete";
  const title = isDelete ? "Delete this title?" : "Unpublish this title?";
  const body = isDelete
    ? "This permanently deletes the listing, cover, and manuscript from your bookshelf. Past orders and downloads are preserved. This cannot be undone."
    : "The title will be hidden from the store immediately. Existing customers keep access to their downloads. You can republish it any time.";
  const cta = isDelete ? "Delete permanently" : "Unpublish";
  const ctaCls = isDelete
    ? "bg-red-600 text-white hover:bg-red-700"
    : "bg-navy text-white hover:bg-navy/90";
  const iconCls = isDelete ? "text-red-600 bg-red-50" : "text-navy bg-navy/5";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-navy/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${iconCls}`}>
            {isDelete ? <Trash2 size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg text-navy">{title}</h3>
            <p className="mt-1 text-sm text-mute leading-relaxed">{body}</p>
            <p className="mt-3 text-sm font-medium text-ink line-clamp-2">
              "{state.product.title}"
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-sm font-semibold text-ink/80 hover:bg-paper"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${ctaCls}`}
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}
