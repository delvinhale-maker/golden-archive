import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Check, Sparkles, ArrowDown } from "lucide-react";
import { submitCreatorLead } from "@/lib/creator-leads.functions";

/**
 * Tune these numbers to change the earnings estimate — nothing is hardcoded below.
 */
const CALC_CONFIG = {
  /** Share of followers assumed to buy each month (0.002 = 0.2%). */
  conversionRate: 0.002,
  /** Low-end price point per sale (USD). */
  lowPrice: 7.99,
  /** High-end price point per sale (USD). */
  highPrice: 19.99,
  /** Creator take-home share after AurumVault's 15% fee. */
  takeHomeRate: 0.85,
  /** Slider bounds + step for the follower input. */
  followerMin: 0,
  followerMax: 100_000,
  followerStep: 500,
  /** Default slider position on first load. */
  followerDefault: 10_000,
  /** Product types shown in the dropdown. */
  productTypes: ["Journals", "Planners", "Prompt Packs", "Ebooks", "Other"] as const,
};

export const Route = createFileRoute("/sell-with-us")({
  component: SellWithUsPage,
  head: () => ({
    meta: [
      { title: "How Much Could You Earn Selling on AurumVault?" },
      {
        name: "description",
        content:
          "Estimate your monthly earnings as an AurumVault creator, then grab the free Seller Starter Kit — templates, pricing guide, and launch checklist.",
      },
      { property: "og:title", content: "How Much Could You Earn Selling on AurumVault?" },
      {
        property: "og:description",
        content:
          "Journals, planners, prompt packs and ebooks. Keep 85% of every sale, paid every Friday. Get the free Seller Starter Kit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "How Much Could You Earn Selling on AurumVault?" },
      {
        name: "twitter:description",
        content: "Keep 85% of every sale, paid every Friday. Get the free AurumVault Seller Starter Kit.",
      },
    ],
    links: [{ rel: "canonical", href: "https://www.aurumvault.store/sell-with-us" }],
  }),
});

const emailSchema = z
  .string()
  .trim()
  .min(3, "Please enter your email")
  .max(255, "That email is too long")
  .email("Please enter a valid email address");

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function SellWithUsPage() {
  const [productType, setProductType] = useState<string>(CALC_CONFIG.productTypes[0]);
  const [followers, setFollowers] = useState<number>(CALC_CONFIG.followerDefault);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot — real users never see this
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);
  const mountedAt = useRef<number>(Date.now());
  const submitLead = useServerFn(submitCreatorLead);

  const { low, high, sales } = useMemo(() => {
    const estimatedMonthlySales = followers * CALC_CONFIG.conversionRate;
    return {
      sales: estimatedMonthlySales,
      low: estimatedMonthlySales * CALC_CONFIG.lowPrice * CALC_CONFIG.takeHomeRate,
      high: estimatedMonthlySales * CALC_CONFIG.highPrice * CALC_CONFIG.takeHomeRate,
    };
  }, [followers]);

  const atMax = followers >= CALC_CONFIG.followerMax;

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      // Server-side dedupe: a unique index on (email, product_type) means a repeat
      // signup is ignored rather than inserted again.
      await submitLead({
        data: {
          email: parsed.data.toLowerCase(),
          productType,
          followerCount: Math.round(followers),
          company,
          elapsedMs: Date.now() - mountedAt.current,
        },
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong saving your details. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-navy text-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(201,162,39,0.22),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-4xl px-5 md:px-8 py-16 md:py-24 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
            <Sparkles size={12} /> For creators
          </p>
          <h1 className="mt-5 font-display text-3xl leading-tight text-white md:text-5xl">
            How Much Could You Earn Selling on AurumVault?
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            Join the creators already turning journals, planners, and prompt packs into passive
            income — keep 85% of every sale, paid out every Friday.
          </p>
          <button
            type="button"
            onClick={scrollToForm}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-navy transition-shadow hover:shadow-[0_14px_40px_-12px_rgba(201,162,39,0.6)]"
          >
            Get My Free Starter Kit <ArrowDown size={15} />
          </button>
        </div>
      </section>

      {/* Calculator */}
      <section className="mx-auto max-w-3xl px-5 md:px-8 pb-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-8 backdrop-blur">
          <h2 className="font-display text-2xl text-white md:text-3xl">Earnings calculator</h2>
          <p className="mt-1 text-sm text-white/60">
            A rough estimate based on typical creator conversion — your real numbers depend on
            pricing and audience fit.
          </p>

          <div className="mt-7 grid gap-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-white/80">
                What do you create?
              </span>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="w-full min-h-[46px] rounded-xl border border-white/15 bg-navy px-4 text-sm text-white outline-none focus:border-gold focus:ring-2 focus:ring-gold/25"
              >
                {CALC_CONFIG.productTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-white/80">
                  Followers / subscribers
                </span>
                <span className="font-mono text-sm text-gold">
                  {followers.toLocaleString("en-US")}
                  {atMax ? "+" : ""}
                </span>
              </div>
              <input
                type="range"
                min={CALC_CONFIG.followerMin}
                max={CALC_CONFIG.followerMax}
                step={CALC_CONFIG.followerStep}
                value={followers}
                onChange={(e) => setFollowers(Number(e.target.value))}
                aria-label="Followers or subscribers"
                className="w-full accent-[#c9a227]"
              />
              <div className="mt-1 flex justify-between text-[11px] text-white/40">
                <span>0</span>
                <span>100k+</span>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-gold/25 bg-gold/[0.08] p-5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
              Estimated monthly earnings
            </p>
            <p className="mt-2 font-display text-3xl md:text-4xl">
              {usd(low)}–{usd(high)}
            </p>
            <p className="mt-2 text-xs text-white/60">
              ≈ {Math.round(sales).toLocaleString("en-US")} sales/month from{" "}
              {productType.toLowerCase()} · based on your 85% share
            </p>
          </div>
        </div>
      </section>

      {/* Email capture */}
      <section className="mx-auto max-w-3xl px-5 md:px-8 pt-6 pb-14">
        <div
          ref={formRef}
          id="starter-kit"
          className="scroll-mt-32 rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-8"
        >
          {done ? (
            <div className="text-center py-4">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold text-navy">
                <Check size={22} />
              </span>
              <h2 className="mt-4 font-display text-2xl text-white">Your Starter Kit is on its way</h2>
              <p className="mt-2 text-sm text-white/70">
                Check your inbox shortly — we'll send the templates, pricing guide, and launch
                checklist to <span className="text-gold">{email.trim().toLowerCase()}</span>.
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl text-white md:text-3xl">
                Get your free Seller Starter Kit to launch your first product
              </h2>
              <p className="mt-2 text-sm text-white/65">
                Templates, a pricing guide, and a launch checklist. No account or password needed.
              </p>
              <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  maxLength={255}
                  autoComplete="email"
                  aria-label="Email address"
                  className="min-h-[48px] flex-1 rounded-xl border border-white/15 bg-navy px-4 text-sm text-white placeholder:text-white/35 outline-none focus:border-gold focus:ring-2 focus:ring-gold/25"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[48px] rounded-xl bg-gold px-6 text-sm font-bold text-navy disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send my kit"}
                </button>
              </form>
              {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            </>
          )}
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-4xl px-5 md:px-8 py-12 md:py-16">
          <ul className="grid gap-5 md:grid-cols-3">
            {[
              "Keep 85% of every sale — no listing fees, no monthly cost to start.",
              "Paid out every Friday, automatically — no chasing invoices.",
              "Your products, your brand — we bring the traffic and handle checkout.",
            ].map((t) => (
              <li
                key={t}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-relaxed text-white/80"
              >
                <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Check size={16} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-3xl px-5 md:px-8 py-14 text-center">
          <h2 className="font-display text-2xl text-white md:text-3xl">Ready to see your first sale?</h2>
          <p className="mt-2 text-sm text-white/65">
            Grab the kit, then apply whenever you're ready.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={scrollToForm}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-gold px-7 text-sm font-bold text-navy transition-shadow hover:shadow-[0_14px_40px_-12px_rgba(201,162,39,0.6)]"
            >
              Get My Free Starter Kit
            </button>
            <Link
              to="/sell"
              className="inline-flex min-h-[48px] items-center rounded-full border border-white/20 px-7 text-sm font-semibold text-white/85 hover:border-gold hover:text-white"
            >
              Apply to sell
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
