import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { CheckCircle2, XCircle, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type App = { id: string; user_id: string; brand_name: string; pitch: string; product_types: string | null; status: string; created_at: string };
type Prod = { id: string; seller_id: string; title: string; description: string; category: string; price_cents: number; cover_url: string | null; status: string; created_at: string };

function AdminPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [apps, setApps] = useState<App[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [tab, setTab] = useState<"products" | "applications">("products");

  useEffect(() => {
    if (!loading && user && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, user, isAdmin, navigate]);

  async function refresh() {
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase.from("seller_applications").select("*").eq("status", "pending").order("created_at"),
      supabase.from("marketplace_products").select("*").eq("status", "pending").order("created_at"),
    ]);
    setApps((a ?? []) as App[]);
    setProds((p ?? []) as Prod[]);
  }

  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  async function approveApp(a: App) {
    const { error: e1 } = await supabase.from("seller_applications").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", a.id);
    const { error: e2 } = await supabase.from("user_roles").insert({ user_id: a.user_id, role: "seller" });
    const { error: e3 } = await supabase.from("profiles").update({ is_seller: true }).eq("id", a.user_id);
    if (e1 || (e2 && !e2.message.includes("duplicate")) || e3) {
      toast.error(e1?.message || e2?.message || e3?.message || "Failed");
      return;
    }
    toast.success(`${a.brand_name} approved`);
    refresh();
  }
  async function rejectApp(a: App) {
    await supabase.from("seller_applications").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", a.id);
    toast.success("Application rejected");
    refresh();
  }
  async function approveProd(p: Prod) {
    await supabase.from("marketplace_products").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", p.id);
    toast.success(`"${p.title}" is now live`);
    refresh();
  }
  async function rejectProd(p: Prod) {
    const reason = window.prompt("Reason for rejection (visible to seller):", "Does not meet our quality guidelines.");
    if (!reason) return;
    await supabase.from("marketplace_products").update({ status: "rejected", rejected_reason: reason }).eq("id", p.id);
    toast.success("Product rejected");
    refresh();
  }

  if (loading) return null;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center gap-4">
          <Link to="/"><AVLogo /></Link>
          <span className="inline-flex items-center gap-1.5 text-sm rounded-full bg-gold/15 text-gold px-3 py-1">
            <ShieldCheck size={14} /> Admin
          </span>
          <Link to="/dashboard" className="ml-auto text-sm text-white/70 hover:text-white inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 md:px-8 py-8 space-y-6">
        <h1 className="font-display text-3xl md:text-4xl text-navy">Approval queue</h1>

        <div className="flex gap-2 border-b border-ink/10">
          {(["products", "applications"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? "border-gold text-navy" : "border-transparent text-mute"}`}>
              {t === "products" ? `Products (${prods.length})` : `Seller applications (${apps.length})`}
            </button>
          ))}
        </div>

        {tab === "products" ? (
          prods.length === 0 ? <Empty msg="No products awaiting review." /> :
          <div className="grid gap-4">
            {prods.map((p) => (
              <div key={p.id} className="bg-white border border-ink/10 rounded-2xl p-4 flex gap-4">
                <div className="w-28 h-28 shrink-0 rounded-lg bg-gradient-to-br from-navy to-[#22335A]" style={p.cover_url ? { backgroundImage: `url(${p.cover_url})`, backgroundSize: "cover" } : {}} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-mute">{p.category}</p>
                  <p className="font-display text-xl text-navy">{p.title}</p>
                  <p className="text-sm text-mute mt-1 line-clamp-2">{p.description}</p>
                  <p className="text-gold font-medium mt-2">${(p.price_cents / 100).toFixed(2)}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => approveProd(p)} className="inline-flex items-center gap-1 text-sm rounded-full bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-700">
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button onClick={() => rejectProd(p)} className="inline-flex items-center gap-1 text-sm rounded-full bg-red-600 text-white px-3 py-1.5 hover:bg-red-700">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          apps.length === 0 ? <Empty msg="No seller applications pending." /> :
          <div className="grid gap-4">
            {apps.map((a) => (
              <div key={a.id} className="bg-white border border-ink/10 rounded-2xl p-5">
                <p className="font-display text-xl text-navy">{a.brand_name}</p>
                {a.product_types && <p className="text-[12px] text-mute mt-1">Selling: {a.product_types}</p>}
                <p className="text-sm text-ink/80 mt-3 whitespace-pre-wrap">{a.pitch}</p>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => approveApp(a)} className="inline-flex items-center gap-1 text-sm rounded-full bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-700">
                    <CheckCircle2 size={14} /> Approve seller
                  </button>
                  <button onClick={() => rejectApp(a)} className="inline-flex items-center gap-1 text-sm rounded-full bg-red-600 text-white px-3 py-1.5 hover:bg-red-700">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center text-mute">{msg}</div>;
}
