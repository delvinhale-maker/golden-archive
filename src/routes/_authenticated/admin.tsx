import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { CheckCircle2, XCircle, ShieldCheck, ArrowLeft, Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sendTransactionalEmail } from "@/lib/email/send";
import { useServerFn } from "@tanstack/react-start";
import { reviewProduct } from "@/lib/ai-review.functions";
import { AIReviewBadge } from "@/components/marketplace/AIReviewBadge";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type App = { id: string; user_id: string; brand_name: string; pitch: string; product_types: string | null; status: string; created_at: string; applicant_email: string | null };
type AIIssue = { severity: "low" | "medium" | "high"; area: string; message: string };
type Prod = {
  id: string; seller_id: string; title: string; description: string; category: string;
  price_cents: number; cover_url: string | null; status: string; created_at: string;
  ai_review_status: string | null; ai_review_score: number | null; ai_review_issues: AIIssue[] | null;
  ai_review_blurb: string | null; ai_review_seo_title: string | null; ai_review_tags: string[] | null;
  ai_reviewed_at: string | null;
};

function AdminPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const runReview = useServerFn(reviewProduct);
  const [apps, setApps] = useState<App[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [tab, setTab] = useState<"products" | "applications">("products");
  const [reviewing, setReviewing] = useState<Record<string, boolean>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    let active = true;
    setCheckingAdmin(true);
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
    return () => {
      active = false;
    };
  }, [loading, user, navigate]);

  async function refresh() {
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase.from("seller_applications").select("*").eq("status", "pending").order("created_at"),
      supabase.from("marketplace_products").select("*").eq("status", "pending").order("created_at"),
    ]);
    setApps((a ?? []) as App[]);
    setProds((p ?? []) as unknown as Prod[]);
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
    if (a.applicant_email) {
      sendTransactionalEmail({
        templateName: "seller-application-approved",
        recipientEmail: a.applicant_email,
        idempotencyKey: `seller-app-approved-${a.id}`,
        templateData: { brandName: a.brand_name },
      }).catch((err) => console.error("Email send failed", err));
    }
    refresh();
  }
  async function rejectApp(a: App) {
    const reason = window.prompt("Reason for rejection (visible to applicant):", "Thanks for applying — we'd like to see more detail about the products you plan to sell.");
    if (reason === null) return;
    await supabase.from("seller_applications").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", a.id);
    toast.success("Application rejected");
    if (a.applicant_email) {
      sendTransactionalEmail({
        templateName: "seller-application-rejected",
        recipientEmail: a.applicant_email,
        idempotencyKey: `seller-app-rejected-${a.id}`,
        templateData: { brandName: a.brand_name, reason: reason || undefined },
      }).catch((err) => console.error("Email send failed", err));
    }
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
  async function runAI(p: Prod) {
    setReviewing((r) => ({ ...r, [p.id]: true }));
    try {
      await runReview({ data: { productId: p.id } });
      toast.success("AI review complete");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI review failed");
    } finally {
      setReviewing((r) => ({ ...r, [p.id]: false }));
    }
  }
  async function applyBlurb(p: Prod) {
    if (!p.ai_review_blurb) return;
    await supabase.from("marketplace_products").update({ description: p.ai_review_blurb }).eq("id", p.id);
    toast.success("Applied AI blurb to description");
    refresh();
  }

  if (loading || checkingAdmin) return null;

  return (
    <div className="min-h-screen bg-paper">
      <PaymentTestModeBanner />
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center gap-4">
          <Link to="/"><AVLogo /></Link>
          <span className="inline-flex items-center gap-1.5 text-sm rounded-full bg-gold/15 text-gold px-3 py-1">
            <ShieldCheck size={14} /> Admin
          </span>
          <Link to="/admin/products" className="ml-auto text-sm text-white/70 hover:text-white">All products</Link>
          <Link to="/admin/messages" className="text-sm text-white/70 hover:text-white">Messages</Link>
          <Link to="/admin/auto-release" className="text-sm text-white/70 hover:text-white">Auto-release</Link>
          <Link to="/dashboard" className="text-sm text-white/70 hover:text-white inline-flex items-center gap-1">
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
              <div key={p.id} className="bg-white border border-ink/10 rounded-2xl p-4">
                <div className="flex gap-4">
                  <div className="w-28 h-28 shrink-0 rounded-lg bg-gradient-to-br from-navy to-[#22335A]" style={p.cover_url ? { backgroundImage: `url(${p.cover_url})`, backgroundSize: "cover" } : {}} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] uppercase tracking-wider text-mute">{p.category}</p>
                      <AIBadge p={p} />
                    </div>
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
                    <button onClick={() => runAI(p)} disabled={reviewing[p.id]} className="inline-flex items-center gap-1 text-xs rounded-full border border-navy/20 text-navy px-3 py-1.5 hover:bg-navy/5 disabled:opacity-50">
                      {reviewing[p.id] ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {p.ai_reviewed_at ? "Re-run AI" : "Run AI"}
                    </button>
                  </div>
                </div>

                {p.ai_reviewed_at && (
                  <div className="mt-4 rounded-xl bg-paper/60 border border-ink/10 p-3 space-y-2">
                    {p.ai_review_issues && p.ai_review_issues.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-navy uppercase tracking-wider mb-1.5">Flagged issues</p>
                        <ul className="space-y-1">
                          {p.ai_review_issues.map((i, idx) => (
                            <li key={idx} className="text-xs flex items-start gap-1.5">
                              <AlertTriangle size={12} className={`mt-0.5 shrink-0 ${i.severity === "high" ? "text-red-600" : i.severity === "medium" ? "text-amber-600" : "text-mute"}`} />
                              <span><span className="font-medium text-navy">{i.area}:</span> <span className="text-ink/80">{i.message}</span></span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {p.ai_review_blurb && (
                      <div>
                        <p className="text-[11px] font-semibold text-navy uppercase tracking-wider mb-1">Suggested SEO blurb</p>
                        <p className="text-xs text-ink/80 italic">"{p.ai_review_blurb}"</p>
                        <button onClick={() => applyBlurb(p)} className="mt-1.5 text-xs text-gold hover:underline">
                          Apply to description →
                        </button>
                      </div>
                    )}
                    {p.ai_review_tags && p.ai_review_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.ai_review_tags.map((t) => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-navy/5 text-navy">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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

function AIBadge({ p }: { p: Prod }) {
  return (
    <AIReviewBadge
      status={(p.ai_review_status as "pass" | "warn" | "fail" | null) ?? "pending"}
      score={p.ai_review_score}
      variant="admin"
    />
  );
}


function Empty({ msg }: { msg: string }) {
  return <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center text-mute">{msg}</div>;
}
