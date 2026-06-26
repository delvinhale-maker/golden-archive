import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { Plus, LogOut, ShieldCheck, Package, Hourglass, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Dashboard,
});

type Application = { id: string; brand_name: string; status: string };
type Product = {
  id: string;
  title: string;
  category: string;
  price_cents: number;
  status: string;
  cover_url: string | null;
  created_at: string;
  rejected_reason: string | null;
  ai_review_status: string | null;
  ai_review_score: number | null;
};


function Dashboard() {
  const navigate = useNavigate();
  const { user, isAdmin, isSeller, signOut } = useAuth();
  const [app, setApp] = useState<Application | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: a }, { data: p }] = await Promise.all([
        supabase.from("seller_applications").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("marketplace_products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
      ]);
      setApp(a as Application | null);
      setProducts((p ?? []) as Product[]);
      setLoading(false);
    })();
  }, [user]);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center gap-4">
          <Link to="/"><AVLogo /></Link>
          <span className="hidden md:inline text-sm text-white/60">Seller Dashboard</span>
          <div className="ml-auto flex items-center gap-2">
            {isAdmin && (
              <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm rounded-full bg-gold/15 text-gold px-3 py-1.5">
                <ShieldCheck size={14} /> Admin
              </Link>
            )}
            <button onClick={handleSignOut} className="text-sm rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 inline-flex items-center gap-1.5">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-8 py-8 md:py-12 space-y-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-navy">Welcome, {user?.email?.split("@")[0]}</h1>
          <p className="mt-1 text-mute">Manage your AurumVault listings, track approvals, and grow your audience.</p>
        </div>

        {loading ? (
          <div className="text-mute">Loading…</div>
        ) : !app ? (
          <SellerCTA />
        ) : app.status === "pending" ? (
          <PendingBanner />
        ) : app.status === "rejected" ? (
          <RejectedBanner />
        ) : null}

        {(isSeller || app?.status === "approved" || isAdmin) && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl text-navy">Your products</h2>
              <Link
                to="/dashboard/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-navy text-white text-sm font-semibold px-4 py-2 hover:bg-navy/90"
              >
                <Plus size={16} /> New product
              </Link>
            </div>

            {products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center">
                <Package className="mx-auto text-mute" />
                <p className="mt-3 font-medium text-navy">No products yet</p>
                <p className="text-sm text-mute mt-1">Upload your first product to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((p) => <ProductRow key={p.id} p={p} />)}
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl bg-white p-6 border border-ink/10">
          <h3 className="font-display text-xl text-navy">How payouts work</h3>
          <p className="mt-2 text-sm text-mute">
            AurumVault takes <strong className="text-navy">9%</strong> per sale. You keep 91% of every transaction.
            Payouts via Stripe Connect will be enabled in Stage 2 — for now, focus on building your catalog.
          </p>
        </section>
      </main>
    </div>
  );
}

function SellerCTA() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-navy to-[#22335A] text-white p-7 md:p-9">
      <h2 className="font-display text-2xl md:text-3xl">Become an AurumVault Creator</h2>
      <p className="mt-2 text-white/80 max-w-xl">
        Apply to join our curated marketplace. We take 9% per sale — you keep 91%. Approval typically within 48 hours.
      </p>
      <Link
        to="/sell"
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gold text-navy font-semibold px-5 py-2.5 hover:bg-gold/90"
      >
        Apply to sell
      </Link>
    </div>
  );
}

function PendingBanner() {
  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-3">
      <Hourglass className="text-amber-600 shrink-0" />
      <div>
        <p className="font-medium text-amber-900">Application under review</p>
        <p className="text-sm text-amber-800 mt-1">We typically review within 48 hours. You'll be notified by email when approved.</p>
      </div>
    </div>
  );
}

function RejectedBanner() {
  return (
    <div className="rounded-2xl bg-red-50 border border-red-200 p-5 flex items-start gap-3">
      <XCircle className="text-red-600 shrink-0" />
      <div>
        <p className="font-medium text-red-900">Application not approved</p>
        <p className="text-sm text-red-800 mt-1">Reach out to support@aurumvault.store if you'd like to reapply.</p>
      </div>
    </div>
  );
}

function ProductRow({ p }: { p: Product }) {
  const badge = {
    approved: { label: "Live", cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 size={12} /> },
    pending: { label: "Pending review", cls: "bg-amber-100 text-amber-700", icon: <Hourglass size={12} /> },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700", icon: <XCircle size={12} /> },
    draft: { label: "Draft", cls: "bg-ink/10 text-ink/70", icon: <Package size={12} /> },
  }[p.status] ?? { label: p.status, cls: "bg-ink/10 text-ink/70", icon: null };

  return (
    <div className="rounded-xl bg-white border border-ink/10 overflow-hidden flex flex-col">
      <div className="aspect-[1/1.6] bg-gradient-to-br from-navy to-[#22335A]" style={p.cover_url ? { backgroundImage: `url(${p.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}} />
      <div className="p-3">
        <p className="font-display text-navy text-base leading-snug line-clamp-2 min-h-[2.6em]">{p.title}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-gold font-display text-lg">${(p.price_cents / 100).toFixed(2)}</span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 ${badge.cls}`}>
            {badge.icon} {badge.label}
          </span>
        </div>
        {p.status === "rejected" && p.rejected_reason && (
          <p className="text-[11px] text-red-700 mt-1">{p.rejected_reason}</p>
        )}
      </div>
    </div>
  );
}
