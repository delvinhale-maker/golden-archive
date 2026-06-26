import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { Plus, LogOut, ShieldCheck, Package, Hourglass, CheckCircle2, XCircle, Upload, BookPlus, Circle } from "lucide-react";
import { AIReviewBadge } from "@/components/marketplace/AIReviewBadge";
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
  published: boolean;
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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                to="/dashboard/new"
                search={{ type: "ebook" }}
                className="group flex items-center gap-4 rounded-2xl bg-navy text-white p-5 md:p-6 hover:bg-navy/90 transition shadow-lg shadow-navy/10"
              >
                <div className="h-12 w-12 rounded-full bg-gold text-navy flex items-center justify-center shrink-0">
                  <BookPlus size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-xl md:text-2xl leading-tight">Create eBook</div>
                  <div className="text-sm text-white/75 mt-0.5">Title, cover, manuscript — publish a new eBook in minutes.</div>
                </div>
                <Plus size={20} className="hidden sm:block opacity-60 group-hover:opacity-100" />
              </Link>
              <Link
                to="/dashboard/new"
                className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-gold to-[#e0bf6f] text-navy p-5 md:p-6 hover:from-[#e0bf6f] hover:to-gold transition shadow-lg shadow-gold/20"
              >
                <div className="h-12 w-12 rounded-full bg-navy text-gold flex items-center justify-center shrink-0">
                  <Upload size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-xl md:text-2xl leading-tight">Upload Product</div>
                  <div className="text-sm text-navy/80 mt-0.5">Courses, audio, templates, prompt packs & bundles.</div>
                </div>
                <Plus size={20} className="hidden sm:block opacity-60 group-hover:opacity-100" />
              </Link>
            </div>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl text-navy">Your products</h2>
                <Link
                  to="/dashboard/new"
                  search={{ type: "ebook" }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-navy text-white text-sm font-semibold px-4 py-2 hover:bg-navy/90"
                >
                  <BookPlus size={16} /> Create eBook
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
          </>
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
  const isLive = p.published && p.status === "approved";
  const liveBadge = isLive
    ? { label: "Live", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 size={12} /> }
    : { label: "Draft", cls: "bg-ink/10 text-ink/70 border-ink/15", icon: <Circle size={12} /> };
  const statusBadge = {
    approved: { label: "Approved", cls: "bg-emerald-50 text-emerald-700" },
    pending: { label: "Pending review", cls: "bg-amber-100 text-amber-700" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700" },
    draft: { label: "Unsubmitted", cls: "bg-ink/10 text-ink/70" },
  }[p.status] ?? { label: p.status, cls: "bg-ink/10 text-ink/70" };

  return (
    <div className="rounded-xl bg-white border border-ink/10 overflow-hidden flex flex-col">
      <div className="aspect-[1/1.6] bg-gradient-to-br from-navy to-[#22335A] relative" style={p.cover_url ? { backgroundImage: `url(${p.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>
        <span className={`absolute top-2 left-2 inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 border ${liveBadge.cls}`}>
          {liveBadge.icon} {liveBadge.label}
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-start gap-2">
          <p className="font-display text-navy text-base leading-snug line-clamp-2 min-h-[2.6em] flex-1">{p.title}</p>
          <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 border ${liveBadge.cls}`}>
            {liveBadge.icon} {liveBadge.label}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-gold font-display text-lg">${(p.price_cents / 100).toFixed(2)}</span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        </div>
        <div className="mt-2">
          <AIReviewBadge
            status={(p.ai_review_status as "pass" | "warn" | "fail" | null) ?? "pending"}
            score={p.ai_review_score}
            variant="seller"
          />
        </div>
        {p.status === "rejected" && p.rejected_reason && (
          <p className="text-[11px] text-red-700 mt-1">{p.rejected_reason}</p>
        )}
      </div>
    </div>
  );
}

