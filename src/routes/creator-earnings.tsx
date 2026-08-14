import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Percent, CalendarCheck, Tag, Lock, Download, Coins } from "lucide-react";
import { submitCreatorLead } from "@/lib/creator-leads.functions";
import { logCtaClick } from "@/lib/cta-tracking";
import { STARTER_KIT_URL, STARTER_KIT_FILENAME } from "@/lib/starter-kit";

export const Route = createFileRoute("/creator-earnings")({
  component: CreatorEarningsPage,
  head: () => ({
    meta: [
      { title: "Creator Earnings Calculator | Keep 85% on AurumVault" },
      {
        name: "description",
        content:
          "See what your audience could earn you on AurumVault. Keep 85% of every sale, paid every Friday, and grab the free Creator Starter Kit.",
      },
      { property: "og:title", content: "Creator Earnings Calculator | Keep 85% on AurumVault" },
      {
        property: "og:description",
        content:
          "Estimate your monthly earnings from prompt packs, eBooks, journals, templates and courses. Keep 85%, paid every Friday.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Creator Earnings Calculator | Keep 85% on AurumVault" },
      {
        name: "twitter:description",
        content: "Keep 85% of every sale, paid every Friday. Free Creator Starter Kit inside.",
      },
    ],
    links: [{ rel: "canonical", href: "https://www.aurumvault.store/creator-earnings" }],
  }),
});

/** Product types and their earnings multipliers — tune here, nothing else. */
const PRODUCTS = [
  { label: "Prompt Packs ($9.99 – $19.99)", value: "Prompt Packs", multiplier: 0.9 },
  { label: "eBooks ($7.99 – $24.99)", value: "eBooks", multiplier: 0.7 },
  { label: "Journals & Planners ($14.99 – $29.99)", value: "Journals & Planners", multiplier: 1.1 },
  { label: "Digital Templates ($9.99 – $49.99)", value: "Digital Templates", multiplier: 0.95 },
  { label: "Online Courses ($29.99 – $99.99)", value: "Online Courses", multiplier: 1.5 },
] as const;

const FOLLOWER_MAX = 1_000_000;
const FOLLOWER_STEP = 1_000;
const FOLLOWER_DEFAULT = 40_000;

const emailSchema = z
  .string()
  .trim()
  .min(3, "Please enter your email")
  .max(255, "That email is too long")
  .email("Please enter a valid email address");

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const BENEFITS = [
  {
    icon: Percent,
    title: "Keep 85%",
    body: "You keep the majority. No hidden fees. Simple, transparent earnings.",
  },
  {
    icon: CalendarCheck,
    title: "Paid Every Friday",
    body: "Reliable weekly payouts you can count on. Money hits your account consistently.",
  },
  {
    icon: Tag,
    title: "Your Brand, Your Products",
    body: "Stay in complete control. Price as you see fit. Keep your audience.",
  },
];

function CreatorEarningsPage() {
  const [product, setProduct] = useState<string>(PRODUCTS[0].value);
  const [followers, setFollowers] = useState<number>(FOLLOWER_DEFAULT);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const mountedAt = useRef<number>(Date.now());
  const submitLead = useServerFn(submitCreatorLead);

  const { low, high } = useMemo(() => {
    const mult = PRODUCTS.find((p) => p.value === product)?.multiplier ?? 1;
    const base = (followers / 100) * mult;
    return { low: base * 0.85, high: base * 1.3 };
  }, [product, followers]);

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
      await submitLead({
        data: {
          email: parsed.data.toLowerCase(),
          productType: product,
          followerCount: Math.round(followers),
          ctaSource: "creator-earnings-cta",
          company,
          elapsedMs: Date.now() - mountedAt.current,
        },
      });
      logCtaClick("creator_earnings_submit");
      setDone(true);
      setEmail("");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy text-white">
      {/* Subtle gold-on-navy vault pattern — fixed behind all glassmorphism sections */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 10%, rgba(201,162,39,0.08) 0%, transparent 28%),
            radial-gradient(circle at 80% 30%, rgba(201,162,39,0.06) 0%, transparent 24%),
            radial-gradient(circle at 50% 80%, rgba(201,162,39,0.07) 0%, transparent 32%),
            radial-gradient(1.5px 1.5px at 12px 18px, rgba(201,162,39,0.22), transparent),
            radial-gradient(1.5px 1.5px at 36px 54px, rgba(201,162,39,0.18), transparent)
          `,
          backgroundSize: "100% 100%, 100% 100%, 100% 100%, 48px 48px, 48px 48px",
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 md:px-8">
          <Link to="/" className="font-display text-lg font-bold text-white">
            AurumVault
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">
            Create. Sell. Keep Yours.
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_55%_at_50%_0%,rgba(201,162,39,0.22),transparent_70%)]"
        />
        {/* Vault arch outline */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 opacity-[0.04] md:h-[160%] md:w-[160%]"
          style={{
            background: `
              radial-gradient(ellipse at 50% 100%, transparent 58%, rgba(201,162,39,0.55) 60%, transparent 62%),
              radial-gradient(ellipse at 50% 100%, transparent 68%, rgba(201,162,39,0.35) 70%, transparent 72%),
              radial-gradient(ellipse at 50% 100%, transparent 78%, rgba(201,162,39,0.18) 80%, transparent 82%)
            `,
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-16 text-center md:px-8 md:py-24">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
            <Coins size={28} aria-hidden="true" />
          </span>
          <h1 className="mt-6 font-display text-3xl leading-tight !text-white md:text-5xl">
            How Much Could You Earn Selling on <span className="text-gold">AurumVault</span>?
          </h1>
          <p className="mt-5 text-base text-white/75 md:text-lg">
            Keep 85% of every sale, paid out every Friday.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="mx-auto max-w-3xl px-5 pb-8 md:px-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
            Earnings calculator
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-white/80">
                What are you selling?
              </span>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="min-h-[46px] w-full rounded-xl border border-white/15 bg-navy px-4 text-sm text-white outline-none focus:border-gold focus:ring-2 focus:ring-gold/25"
              >
                {PRODUCTS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-2 block text-[13px] font-semibold text-white/80">
                How many followers do you have?
              </span>
              <input
                type="range"
                min={0}
                max={FOLLOWER_MAX}
                step={FOLLOWER_STEP}
                value={followers}
                onChange={(e) => setFollowers(Number(e.target.value))}
                aria-label="Follower count"
                className="w-full accent-[#c9a227]"
              />
              <p className="mt-1 font-mono text-sm text-gold">
                {followers.toLocaleString("en-US")}
                {followers >= FOLLOWER_MAX ? "+" : ""} followers
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-gold/25 bg-gold/[0.08] p-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
              Estimated monthly earnings
            </p>
            <p
              key={`${product}-${followers}`}
              className="mt-2 animate-in fade-in font-display text-4xl text-gold md:text-5xl"
            >
              {usd(low)}–{usd(high)}
            </p>
            <p className="mt-3 text-xs text-white/60">
              Based on typical creator activity. Your actual results may vary.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-16">
        <h2 className="text-center font-display text-2xl !text-white md:text-3xl">
          Why Creators Choose AurumVault
        </h2>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-gold/60 hover:shadow-gold-glow"
            >
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold">
                <Icon size={18} aria-hidden="true" />
              </span>
              <h3 className="font-display text-lg text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-2xl px-5 py-14 text-center md:px-8">
          <h2 className="font-display text-2xl text-white md:text-3xl">
            Ready to Turn Your Content Into Income?
          </h2>
          <p className="mt-3 text-sm text-white/70">
            Get your free Creator Starter Kit and learn how to get started.
          </p>

          {done ? (
            <div className="mt-7 rounded-2xl border border-gold/30 bg-gold/[0.08] p-6">
              <p className="text-sm text-white">
                ✓ Thanks! Check your email for the Creator Starter Kit.
              </p>
              <a
                href={STARTER_KIT_URL}
                download={STARTER_KIT_FILENAME}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logCtaClick("creator_earnings_download")}
                className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-gold px-6 text-sm font-bold uppercase tracking-wide text-navy transition hover:brightness-95"
              >
                <Download size={16} aria-hidden="true" /> Download your Starter Kit
              </a>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-7 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                name="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
              />
              <input
                type="email"
                required
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
                className="min-h-[48px] rounded-xl bg-gold px-6 text-sm font-bold uppercase tracking-wide text-navy transition hover:brightness-95 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Get my free starter kit"}
              </button>
            </form>
          )}
          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-white/55">
            <Lock size={12} aria-hidden="true" /> We respect your privacy. Unsubscribe anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 py-8 text-xs text-white/55 md:flex-row md:justify-between md:px-8">
          <p>© 2026 AurumVault. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/creator-agreement" className="hover:text-gold">
              Creator Agreement
            </Link>
            <Link to="/support" className="hover:text-gold">
              FAQ
            </Link>
            <a href="mailto:support@aurumvault.tech" className="hover:text-gold">
              Contact Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
