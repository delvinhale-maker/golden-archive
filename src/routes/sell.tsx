import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { sendTransactionalEmail } from "@/lib/email/send";

export const Route = createFileRoute("/sell")({
  component: SellPage,
  head: () => ({
    meta: [
      { title: "Sell on AurumVault — Apply to Become a Creator" },
      { name: "description", content: "Join AurumVault's curated marketplace. Keep 91% of every sale. Apply in 2 minutes." },
    ],
  }),
});

function SellPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [brandName, setBrandName] = useState("");
  const [pitch, setPitch] = useState("");
  const [productTypes, setProductTypes] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<{ status: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("seller_applications").select("status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setExisting(data as { status: string } | null));
  }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { navigate({ to: "/auth" }); return; }
    setBusy(true);
    const { error } = await supabase.from("seller_applications").insert({
      user_id: user.id, brand_name: brandName, pitch, product_types: productTypes, website: website || null,
      applicant_email: user.email ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Application submitted. We'll review within 48 hours.");
    if (user.email) {
      sendTransactionalEmail({
        templateName: "seller-application-received",
        recipientEmail: user.email,
        idempotencyKey: `seller-app-received-${user.id}-${Date.now()}`,
        templateData: { brandName },
      }).catch((err) => console.error("Email send failed", err));
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center gap-4">
          <Link to="/"><AVLogo /></Link>
          <Link to="/" className="ml-auto text-sm text-white/70 hover:text-white">← Back to shop</Link>
        </div>
      </header>

      <section className="bg-gradient-to-br from-navy to-[#22335A] text-white py-14 md:py-20">
        <div className="mx-auto max-w-3xl px-4 md:px-8 text-center">
          <p className="text-gold text-xs uppercase tracking-[0.3em] font-semibold">For Creators</p>
          <h1 className="mt-3 font-display text-4xl md:text-6xl leading-tight">Sell on AurumVault</h1>
          <p className="mt-4 text-lg text-white/80">
            Kingdom resources, royal quality. Apply to join a curated marketplace built for purpose-driven creators.
          </p>
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-4 text-sm">
            <Pill>You keep 91%</Pill>
            <Pill>9% platform fee</Pill>
            <Pill>48-hour review</Pill>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 md:px-8 py-10 md:py-14">
        <div className="grid md:grid-cols-3 gap-3 mb-10">
          {["Apply in 2 minutes", "Get approved within 48 hrs", "Upload & start selling"].map((t, i) => (
            <div key={t} className="rounded-xl bg-white border border-ink/10 p-4 flex items-start gap-3">
              <span className="h-7 w-7 shrink-0 rounded-full bg-gold/20 text-gold flex items-center justify-center text-sm font-bold">{i + 1}</span>
              <p className="text-sm font-medium text-navy">{t}</p>
            </div>
          ))}
        </div>

        {!loading && existing ? (
          <div className="rounded-2xl bg-white border border-ink/10 p-8 text-center">
            <Check className="mx-auto text-gold" />
            <p className="font-display text-2xl text-navy mt-3">Application {existing.status}</p>
            <p className="text-mute mt-2">Head to your dashboard to track status and manage products.</p>
            <Link to="/dashboard" className="mt-5 inline-flex rounded-full bg-navy text-white px-5 py-2.5 font-semibold">Open dashboard</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-2xl border border-ink/10 p-6 md:p-8 space-y-5">
            <h2 className="font-display text-2xl text-navy">Creator application</h2>
            <Field label="Brand / creator name">
              <input required value={brandName} onChange={(e) => setBrandName(e.target.value)} className="inp" placeholder="Your brand or full name" />
            </Field>
            <Field label="What will you sell? (a few words)">
              <input value={productTypes} onChange={(e) => setProductTypes(e.target.value)} className="inp" placeholder="eBooks, courses, templates…" />
            </Field>
            <Field label="Tell us about your work">
              <textarea required value={pitch} onChange={(e) => setPitch(e.target.value)} rows={5} className="inp" placeholder="Who you are, what you create, who it's for." />
            </Field>
            <Field label="Website or portfolio (optional)">
              <input value={website} onChange={(e) => setWebsite(e.target.value)} className="inp" placeholder="https://…" />
            </Field>
            <button type="submit" disabled={busy} className="w-full h-12 rounded-full bg-navy text-white font-semibold hover:bg-navy/90 disabled:opacity-60">
              {busy ? "Submitting…" : user ? "Submit application" : "Sign in to apply"}
            </button>
            {!user && <p className="text-center text-xs text-mute">You'll be asked to sign in first.</p>}
          </form>
        )}
      </main>
      <style>{`.inp{display:block;width:100%;min-height:44px;border-radius:12px;border:1px solid rgb(0 0 0 / 0.12);padding:10px 14px;font-size:14px;background:white;color:#0F1A33}.inp:focus{outline:none;border-color:#C9A24B;box-shadow:0 0 0 3px rgb(201 162 75 / 0.15)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-navy mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-white/10 border border-white/15 px-3 py-1 text-white">{children}</span>;
}
