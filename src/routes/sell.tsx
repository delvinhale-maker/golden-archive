import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { sendTransactionalEmail } from "@/lib/email/send";

export const Route = createFileRoute("/sell")({
  component: SellPage,
  head: () => ({
    meta: [
      { title: "Apply to Sell on AurumVault | Creator Application" },
      { name: "description", content: "Apply to join AurumVault. Keep 70% of every sale. 4-step application, 48-hour review." },
      { property: "og:title", content: "Apply to Sell on AurumVault" },
      { property: "og:description", content: "Apply to join AurumVault. Keep 70% of every sale." },
      { property: "og:url", content: "https://www.aurumvault.store/sell" },
      { name: "twitter:title", content: "Apply to Sell on AurumVault" },
      { name: "twitter:description", content: "Apply to join AurumVault. Keep 70% of every sale." },
    ],
    links: [{ rel: "canonical", href: "https://www.aurumvault.store/sell" }],
  }),
});

const CATEGORY_OPTIONS = [
  "eBooks",
  "Online Courses",
  "Templates & Kits",
  "Audio & Music",
  "Design Assets",
  "Coaching & Guides",
];

const PRICE_RANGES = ["Under $10", "$10 – $25", "$25 – $50", "$50 – $100", "$100+"];

const step1Schema = z.object({
  brandName: z.string().trim().min(2, "Please enter your brand or creator name").max(100),
  country: z.string().trim().min(2, "Please enter your country").max(80),
});
const step2Schema = z.object({
  categories: z.array(z.string()).min(1, "Pick at least one category"),
  priceRange: z.string().min(1, "Pick a typical price range"),
  productTypes: z.string().trim().max(300).optional().or(z.literal("")),
});
const step3Schema = z.object({
  pitch: z.string().trim().min(30, "Tell us at least a couple sentences (30+ chars)").max(2000),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  instagram: z.string().trim().max(120).optional().or(z.literal("")),
  twitter: z.string().trim().max(120).optional().or(z.literal("")),
  youtube: z.string().trim().max(120).optional().or(z.literal("")),
});
const step4Schema = z.object({
  agree: z.literal(true, { errorMap: () => ({ message: "You must accept the creator agreement" }) }),
  tax: z.literal(true, { errorMap: () => ({ message: "Please acknowledge the tax notice" }) }),
});

function SellPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<{ status: string } | null>(null);

  // Form state
  const [brandName, setBrandName] = useState("");
  const [country, setCountry] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState("");
  const [productTypes, setProductTypes] = useState("");
  const [pitch, setPitch] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [youtube, setYoutube] = useState("");
  const [agree, setAgree] = useState(false);
  const [tax, setTax] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    supabase.from("seller_applications").select("status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setExisting(data as { status: string } | null));
  }, [user]);

  const progress = useMemo(() => (step / 4) * 100, [step]);

  function validateStep(n: number): boolean {
    setErrors({});
    const result =
      n === 1 ? step1Schema.safeParse({ brandName, country })
      : n === 2 ? step2Schema.safeParse({ categories, priceRange, productTypes })
      : n === 3 ? step3Schema.safeParse({ pitch, website, instagram, twitter, youtube })
      : step4Schema.safeParse({ agree, tax });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[i.path.join(".")] = i.message; });
      setErrors(errs);
      return false;
    }
    return true;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(4, s + 1));
  }
  function back() { setStep((s) => Math.max(1, s - 1)); }

  async function submit() {
    if (!user) { navigate({ to: "/auth" }); return; }
    if (!validateStep(4)) return;
    setBusy(true);
    const socialLinks = { instagram, twitter, youtube };
    const { error } = await supabase.from("seller_applications").insert({
      user_id: user.id,
      brand_name: brandName,
      pitch,
      product_types: productTypes || categories.join(", "),
      website: website || null,
      applicant_email: user.email ?? null,
      country: country || null,
      categories: categories.length ? categories : null,
      price_range: priceRange || null,
      social_links: socialLinks,
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
          <Link to="/become-a-creator" className="ml-auto text-sm text-white/70 hover:text-white">← Back to overview</Link>
        </div>
      </header>

      <section className="bg-gradient-to-br from-navy to-[#22335A] text-white py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-4 md:px-8 text-center">
          <p className="text-gold text-xs uppercase tracking-[0.3em] font-semibold">Creator Application</p>
          <h1 className="mt-3 font-display text-3xl md:text-5xl leading-tight">Apply to sell on AurumVault</h1>
          <p className="mt-4 text-white/80">Kingdom resources, royal quality. Four short steps.</p>
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 text-sm">
            <Pill>You keep 70%</Pill>
            <Pill>30% platform fee</Pill>
            <Pill>48-hour review</Pill>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 md:px-8 py-10 md:py-14">
        {!loading && existing ? (
          <div className="rounded-2xl bg-white border border-ink/10 p-8 text-center">
            <Check className="mx-auto text-gold" />
            <p className="font-display text-2xl text-navy mt-3">Application {existing.status}</p>
            <p className="text-mute mt-2">Head to your dashboard to track status and manage products.</p>
            <Link to="/dashboard" className="mt-5 inline-flex rounded-full bg-navy text-white px-5 py-2.5 font-semibold">Open dashboard</Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-ink/10 p-6 md:p-8">
            <Progress step={step} progress={progress} />

            <div className="mt-8">
              {step === 1 && (
                <StepBox title="About you" subtitle="Tell us who you are.">
                  <Field label="Brand / creator name" error={errors["brandName"]}>
                    <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className="inp" placeholder="Your brand or full name" />
                  </Field>
                  <Field label="Country" error={errors["country"]}>
                    <input value={country} onChange={(e) => setCountry(e.target.value)} className="inp" placeholder="Where are you based?" />
                  </Field>
                </StepBox>
              )}

              {step === 2 && (
                <StepBox title="What you'll sell" subtitle="Pick the categories that fit your work.">
                  <Field label="Categories" error={errors["categories"]}>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_OPTIONS.map((c) => {
                        const active = categories.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCategories((prev) => active ? prev.filter((x) => x !== c) : [...prev, c])}
                            className={`px-3 py-2 rounded-full border text-sm font-medium transition-colors ${active ? "bg-navy text-white border-navy" : "bg-white text-navy border-ink/15 hover:border-gold"}`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="Typical price range" error={errors["priceRange"]}>
                    <div className="flex flex-wrap gap-2">
                      {PRICE_RANGES.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriceRange(p)}
                          className={`px-3 py-2 rounded-full border text-sm font-medium transition-colors ${priceRange === p ? "bg-navy text-white border-navy" : "bg-white text-navy border-ink/15 hover:border-gold"}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Anything specific? (optional)">
                    <input value={productTypes} onChange={(e) => setProductTypes(e.target.value)} className="inp" placeholder="e.g. sermon slide kits, worship charts…" />
                  </Field>
                </StepBox>
              )}

              {step === 3 && (
                <StepBox title="Your work" subtitle="Show us who you are and where to find you.">
                  <Field label="Tell us about your work" error={errors["pitch"]}>
                    <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} rows={5} className="inp" placeholder="Who you are, what you create, who it's for." />
                  </Field>
                  <Field label="Website or portfolio (optional)">
                    <input value={website} onChange={(e) => setWebsite(e.target.value)} className="inp" placeholder="https://…" />
                  </Field>
                  <div className="grid md:grid-cols-3 gap-4">
                    <Field label="Instagram (optional)">
                      <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className="inp" placeholder="@handle" />
                    </Field>
                    <Field label="Twitter / X (optional)">
                      <input value={twitter} onChange={(e) => setTwitter(e.target.value)} className="inp" placeholder="@handle" />
                    </Field>
                    <Field label="YouTube (optional)">
                      <input value={youtube} onChange={(e) => setYoutube(e.target.value)} className="inp" placeholder="channel URL or @handle" />
                    </Field>
                  </div>
                </StepBox>
              )}

              {step === 4 && (
                <StepBox title="Agreement" subtitle="One last check before you submit.">
                  <div className="rounded-xl border border-ink/10 bg-paper p-4 text-sm text-ink/80 leading-relaxed">
                    <p><strong className="text-navy">Royalty split:</strong> You keep 70% of every sale. AurumVault retains a 30% platform fee.</p>
                    <p className="mt-2"><strong className="text-navy">Content:</strong> All work must be original or properly licensed. You retain full rights.</p>
                    <p className="mt-2"><strong className="text-navy">Payouts:</strong> Processed on the schedule shown in your dashboard, once past our clearance window.</p>
                  </div>
                  <label className="flex items-start gap-3 mt-4 cursor-pointer">
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
                    <span className="text-sm text-ink/80">
                      I've read and accept the <Link to="/creator-agreement" className="text-navy underline">creator agreement</Link>.
                    </span>
                  </label>
                  {errors["agree"] && <p className="text-xs text-red-600 -mt-2 ml-7">{errors["agree"]}</p>}
                  <label className="flex items-start gap-3 mt-3 cursor-pointer">
                    <input type="checkbox" checked={tax} onChange={(e) => setTax(e.target.checked)} className="mt-1" />
                    <span className="text-sm text-ink/80">
                      I understand I'm responsible for reporting my own income and taxes in my country.
                    </span>
                  </label>
                  {errors["tax"] && <p className="text-xs text-red-600 -mt-2 ml-7">{errors["tax"]}</p>}
                </StepBox>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={back}
                disabled={step === 1}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-navy disabled:opacity-40"
              >
                <ArrowLeft size={14} /> Back
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex items-center gap-2 rounded-full bg-navy text-white px-6 py-2.5 text-sm font-semibold hover:bg-navy/90"
                >
                  Continue <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-gold text-navy px-6 py-2.5 text-sm font-bold hover:shadow-[0_10px_30px_-10px_rgba(201,168,76,0.5)] disabled:opacity-60"
                >
                  {busy ? "Submitting…" : user ? "Submit application" : "Sign in to submit"}
                </button>
              )}
            </div>
            {!user && step === 4 && <p className="mt-3 text-center text-xs text-mute">You'll be asked to sign in first.</p>}
          </div>
        )}
      </main>
      <style>{`.inp{display:block;width:100%;min-height:44px;border-radius:12px;border:1px solid rgb(0 0 0 / 0.12);padding:10px 14px;font-size:14px;background:white;color:#0F1A33}.inp:focus{outline:none;border-color:#C9A24B;box-shadow:0 0 0 3px rgb(201 162 75 / 0.15)}`}</style>
    </div>
  );
}

function Progress({ step, progress }: { step: number; progress: number }) {
  const labels = ["About you", "What you'll sell", "Your work", "Agreement"];
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-caps text-gold">Step {step} of 4</span>
        <span className="text-mute">{labels[step - 1]}</span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-ink/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold to-[#e6c76f] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function StepBox({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-navy">{title}</h2>
        <p className="text-sm text-mute mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-navy mb-1.5">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-white/10 border border-white/15 px-3 py-1 text-white">{children}</span>;
}
