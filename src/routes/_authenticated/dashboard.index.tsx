import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { BookOpen, Plus, ExternalLink, Pencil, EyeOff, Hourglass, XCircle } from "lucide-react";
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
  created_at: string;
  price_cents: number;
  category: string;
  rejected_reason: string | null;
};

function BookshelfPage() {
  const { user, isSeller, isAdmin } = useAuth();
  const [app, setApp] = useState<Application | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: a }, { data: p }] = await Promise.all([
        supabase.from("seller_applications").select("id,status").eq("user_id", user.id).maybeSingle(),
        supabase.from("marketplace_products").select("id,title,status,published,cover_url,created_at,price_cents,category,rejected_reason").eq("seller_id", user.id).order("created_at", { ascending: false }),
      ]);
      setApp(a as Application | null);
      setProducts((p ?? []) as Product[]);
      setLoading(false);
    })();
  }, [user]);

  const canPublish = isAdmin || isSeller || app?.status === "approved";

  async function unpublish(id: string) {
    const { error } = await supabase
      .from("marketplace_products")
      .update({ published: false })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, published: false } : p)));
    toast.success("Title unpublished.");
  }

  return (
    <PublisherShell accent={ACCENTS.bookshelf}>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-navy">Your Bookshelf</h1>
          <p className="mt-1 text-mute">Manage every title you've published or saved as a draft.</p>
        </div>
        {canPublish && (
          <Link
            to="/dashboard/new"
            className="inline-flex items-center gap-2 rounded-full font-semibold px-5 py-2.5 text-white shadow-md transition-all duration-300 hover:shadow-lg"
            style={{ background: "var(--page-accent)" }}
          >
            <Plus size={16} /> Create New Title
          </Link>
        )}
      </div>

      {!loading && !app && !isAdmin && (
        <div className="mt-8 rounded-2xl bg-white border border-ink/10 p-7">
          <h2 className="font-display text-xl text-navy">Become an AurumVault Creator</h2>
          <p className="mt-1 text-sm text-mute">Apply once — get reviewed within 48 hours. We keep 9%, you keep 91%.</p>
          <Link to="/sell" className="mt-4 inline-flex rounded-full bg-gold text-navy font-semibold px-5 py-2.5 hover:bg-gold/90">
            Apply to sell
          </Link>
        </div>
      )}
      {!loading && app?.status === "pending" && (
        <div className="mt-8 rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-3">
          <Hourglass className="text-amber-600 shrink-0" />
          <div>
            <p className="font-medium text-amber-900">Application under review</p>
            <p className="text-sm text-amber-800 mt-1">Typically within 48 hours — you'll get an email when approved.</p>
          </div>
        </div>
      )}
      {!loading && app?.status === "rejected" && (
        <div className="mt-8 rounded-2xl bg-red-50 border border-red-200 p-5 flex items-start gap-3">
          <XCircle className="text-red-600 shrink-0" />
          <p className="text-sm text-red-900">Application not approved. Email support@aurumvault.store to reapply.</p>
        </div>
      )}

      <section className="mt-8">
        {loading ? (
          <div className="text-mute">Loading your bookshelf…</div>
        ) : products.length === 0 ? (
          <EmptyState canPublish={canPublish} />
        ) : (
          <BookshelfTable products={products} onUnpublish={unpublish} />
        )}
      </section>
    </PublisherShell>
  );
}

function EmptyState({ canPublish }: { canPublish: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-12 text-center">
      <BookOpen className="mx-auto text-mute" size={32} />
      <p className="mt-4 font-display text-xl text-navy">You haven't published any titles yet.</p>
      <p className="mt-1 text-sm text-mute">Click "Create New Title" to get started.</p>
      {canPublish && (
        <Link
          to="/dashboard/new"
          className="mt-5 inline-flex items-center gap-2 rounded-full font-semibold px-5 py-2.5 text-white"
          style={{ background: "var(--page-accent)" }}
        >
          <Plus size={16} /> Create New Title
        </Link>
      )}
    </div>
  );
}

function statusBadge(p: Product) {
  if (p.status === "pending") return { label: "Under Review", cls: "bg-amber-100 text-amber-800 border-amber-200" };
  if (p.published && p.status === "approved") return { label: "Live", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  if (p.status === "rejected") return { label: "Rejected", cls: "bg-red-100 text-red-800 border-red-200" };
  return { label: "Draft", cls: "bg-ink/10 text-ink/70 border-ink/15" };
}

function formatFor(category: string): string {
  if (category === "ebooks") return "eBook";
  return "eBook";
}

function BookshelfTable({ products, onUnpublish }: { products: Product[]; onUnpublish: (id: string) => void }) {
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
              <th className="text-left font-semibold px-4 py-3">Date</th>
              <th className="text-right font-semibold px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const badge = statusBadge(p);
              const isLive = p.published && p.status === "approved";
              return (
                <tr key={p.id} className="border-b border-ink/5 last:border-0 hover:bg-paper/50 transition-colors">
                  <td className="px-4 py-3">
                    <div
                      className="h-14 w-10 rounded shadow-sm bg-gradient-to-br from-navy to-[#22335A] bg-cover bg-center"
                      style={p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : undefined}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-display text-navy text-base leading-snug max-w-md">{p.title}</div>
                    <div className="text-xs text-mute mt-0.5">${(p.price_cents / 100).toFixed(2)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-[11px] font-semibold rounded-full px-2.5 py-1 border ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/80">{formatFor(p.category)}</td>
                  <td className="px-4 py-3 text-mute whitespace-nowrap">
                    {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled
                        title="Editing coming soon"
                        className="inline-flex items-center gap-1 text-xs font-medium text-mute px-2 py-1.5 rounded hover:bg-paper disabled:cursor-not-allowed"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      {isLive && (
                        <Link
                          to="/products/$id"
                          params={{ id: p.id }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-navy px-2 py-1.5 rounded hover:bg-paper"
                        >
                          <ExternalLink size={13} /> View on Store
                        </Link>
                      )}
                      {isLive && (
                        <button
                          type="button"
                          onClick={() => onUnpublish(p.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-700 px-2 py-1.5 rounded hover:bg-red-50"
                        >
                          <EyeOff size={13} /> Unpublish
                        </button>
                      )}
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
