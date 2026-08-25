import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  DollarSign,
  Users,
  BookOpen,
  Wand2,
  BarChart3,
  Mail,
  ShieldCheck,
  Crown,
  Check,
  QrCode,
  Store,
  Download,
} from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { logCtaClick } from "@/lib/cta-tracking";


const NAVY = "#1B2A4A";
const NAVY_DEEP = "#11192E";
const GOLD = "#C9A84C";

const DESCRIPTION =
  "Sell your digital products on AurumVault: keep 85% of every sale, pay $0 to list or apply, keep 100% ownership of your work, and get your own storefront with trackable QR codes.";

export const Route = createFileRoute("/become-a-creator")({
  head: () => ({
    meta: [
      { title: "Sell on AurumVault | Keep 85%, $0 Fees, Own Your Work" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Build Your Store. Keep 85%. Own Your Work." },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.aurumvault.store/become-a-creator" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Build Your Store. Keep 85%. Own Your Work." },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [
      { rel: "canonical", href: "https://www.aurumvault.store/become-a-creator" },
    ],
  }),
  component: BecomeACreatorPage,
});

function BecomeACreatorPage() {
  return (
    <MarketShell>
      <Hero />
      <ValueStrip />
      <ValueProps />
      <StorefrontAndQR />
      <StartCreatingCTA />
      <PreSetupFAQ />
      <HowItWorks />
      <WhatToSell />
      <CreatorTools />
      <FoundingBand />
      <StarterPackBand />
      <TrustBand />
      <FAQ />
      <FinalCTA />
    </MarketShell>
  );
}

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-1/4 h-[560px] w-[560px] rounded-full blur-3xl"
        style={{ background: `${GOLD}33` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.08,
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><g fill='%23C9A84C'><circle cx='10' cy='14' r='1'/><circle cx='62' cy='8' r='0.8'/><circle cx='34' cy='40' r='1.2'/><circle cx='72' cy='52' r='0.9'/><circle cx='18' cy='66' r='1'/><path d='M40 6 L41 9 L44 9 L41.5 11 L42.5 14 L40 12 L37.5 14 L38.5 11 L36 9 L39 9 Z'/></g></svg>\")",
          backgroundSize: "240px 240px",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-20 md:py-28 text-center">
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ borderColor: `${GOLD}55`, color: GOLD }}
        >
          <Crown size={12} /> Sell on AurumVault
        </div>
        <h1
          className="mx-auto max-w-4xl text-4xl leading-[1.05] text-white sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Build Your Store.
          <br />
          Keep 85%.{" "}
          <span className="italic" style={{ color: GOLD }}>
            Own Your Work.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base md:text-lg text-white/75">
          A curated marketplace for premium digital products. You keep{" "}
          <strong className="text-white">85%</strong> of every sale, pay{" "}
          <strong className="text-white">$0</strong> to apply or list, and keep{" "}
          <strong className="text-white">100%</strong> of the rights to what you create.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/sell"
            onClick={() => logCtaClick("become_creator_hero_apply")}
            className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-bold transition-all hover:shadow-[0_18px_40px_-12px_rgba(201,168,76,0.6)] active:scale-[0.98]"
            style={{ background: GOLD, color: NAVY }}
          >
            Apply to Sell
            <ArrowRight size={16} />
          </Link>
          <Link
            to="/creator-starter-pack"
            onClick={() => logCtaClick("become_creator_hero_starter_pack")}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/40 px-8 py-4 text-sm font-bold text-white transition-colors hover:bg-white hover:text-navy"
          >
            <Download size={16} /> Get the Free Starter Pack
          </Link>
        </div>
        <p className="mt-5 text-xs text-white/55">
          No application fee · No monthly fee · Reviewed within 48 hours
        </p>
      </div>
    </section>
  );
}

/** Four hard numbers, above the fold on mobile, that answer "what do I actually get?" */
function ValueStrip() {
  const stats = [
    { value: "85%", label: "Your share of every sale" },
    { value: "$0", label: "To apply, list or stay listed" },
    { value: "100%", label: "Ownership of your work" },
    { value: "~2 min", label: "To finish an application" },
  ];
  return (
    <section className="border-b border-ink/10 bg-white py-8 md:py-10">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 sm:px-6 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div
              className="text-3xl md:text-4xl"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: NAVY }}
            >
              {s.value}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Storefront + QR band. Every claim here is verified live in production:
 * creator storefronts at /store/{slug} and dynamic, editable, scan-tracked
 * QR codes with PNG/SVG downloads, campaigns and placement labels.
 */
function StorefrontAndQR() {
  const rows = [
    {
      icon: Store,
      title: "Your own storefront",
      body: "A branded page at aurumvault.store/store/your-name — your cover, your bio, your catalogue, one link to share everywhere.",
    },
    {
      icon: QrCode,
      title: "Trackable QR codes",
      body: "Generate a QR for your storefront or any product, download it as PNG or SVG for print, and change where it points later without reprinting.",
    },
    {
      icon: BarChart3,
      title: "See what's working",
      body: "Group codes into campaigns, label each placement (yard sign, packaging, business card) and watch which one actually earns the scans.",
    },
  ];
  return (
    <section className="bg-paper py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-ink">
            Built For Selling Offline Too
          </p>
          <h2
            className="mt-2 text-3xl text-navy md:text-5xl"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            One link. One code. Every channel.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {rows.map((r) => (
            <div key={r.title} className="rounded-2xl border border-ink/10 bg-white p-8">
              <div
                className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: `${GOLD}1A`, color: GOLD }}
              >
                <r.icon size={22} />
              </div>
              <h3
                className="text-2xl text-navy"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                {r.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Founding 100 cohort invitation — links to the existing registry page. */
function FoundingBand() {
  return (
    <section className="bg-paper py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="rounded-3xl border border-ink/10 bg-white p-8 text-center md:p-12">
          <div
            className="mx-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ borderColor: `${GOLD}66`, color: "#8a6d1f" }}
          >
            <Crown size={12} /> Founding 100
          </div>
          <h2
            className="mt-4 text-3xl text-navy md:text-4xl"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            The first 100 creators are numbered forever.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ink/70 md:text-base">
            Founding Creators carry a permanent numbered mark on their storefront and product
            pages — assigned by us, never self-declared, and never reissued.
          </p>
          <Link
            to="/founding-100"
            onClick={() => logCtaClick("become_creator_founding_100")}
            className="mt-7 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-navy px-7 text-sm font-bold text-gold"
          >
            See the Founding 100 <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Soft-conversion path for visitors who aren't ready to apply yet. */
function StarterPackBand() {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div
          className="rounded-3xl p-8 text-center md:p-12"
          style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}44` }}
        >
          <h2
            className="text-3xl text-navy md:text-4xl"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Not ready to apply yet?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ink/70 md:text-base">
            Take the free Digital Creator Starter Pack: 25 product ideas, a pricing worksheet, a
            launch checklist, quality checks, AI prompts and a 7-Day Creator Sprint. No purchase,
            no obligation.
          </p>
          <Link
            to="/creator-starter-pack"
            onClick={() => logCtaClick("become_creator_starter_pack_band")}
            className="mt-7 inline-flex min-h-[48px] items-center gap-2 rounded-full px-7 text-sm font-bold"
            style={{ background: GOLD, color: NAVY }}
          >
            <Download size={16} /> Get the Free Starter Pack
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Credibility band: concrete, checkable promises instead of vague hype. */
function TrustBand() {
  const items = [
    "You keep 85% of every sale — the 15% platform fee is the only fee.",
    "No application fee, no listing fee, no monthly subscription.",
    "You keep full rights to your work; AurumVault holds a distribution licence only.",
    "Files are delivered through tokenised, expiring links so your work isn't passed around.",
    "Every application is reviewed by a human within 48 hours.",
    "Buyers get a 14-day refund window, applied consistently across the marketplace.",
  ];
  return (
    <section
      className="py-16 text-white md:py-24"
      style={{ background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)` }}
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: GOLD }}>
            The Fine Print, In Plain English
          </p>
          <h2
            className="mt-2 text-3xl md:text-5xl"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            What you can hold us to.
          </h2>
        </div>
        <ul className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
          {items.map((t) => (
            <li key={t} className="flex items-start gap-3 text-sm leading-relaxed text-white/80">
              <Check size={16} className="mt-[3px] shrink-0" style={{ color: GOLD }} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <Link
            to="/about_/trust"
            onClick={() => logCtaClick("become_creator_trust_center")}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full border-2 border-white/40 px-7 text-sm font-bold text-white transition-colors hover:bg-white hover:text-navy"
          >
            Read the Trust Center <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}


function ValueProps() {
  const items = [
    {
      icon: DollarSign,
      title: "85% Royalties",
      body: "Industry-leading split. Keep 85% of every sale, forever. No hidden fees, no subscription tiers, no gotchas.",
    },
    {
      icon: Wand2,
      title: "AI-Powered Tools",
      body: "Cover generation, description writing, SEO copy, and smart pricing — built in. Your studio, on autopilot.",
    },
    {
      icon: Users,
      title: "Built-In Audience",
      body: "Reach purpose-driven buyers already shopping AurumVault. Featured shelves, email pushes, and referrals.",
    },
  ];
  return (
    <section className="bg-paper py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-ink">
          Why AurumVault
        </p>
        <h2
          className="mt-2 text-center text-3xl md:text-5xl text-navy"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Everything you need to sell like a pro.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-2xl bg-white border border-ink/10 p-8 hover:shadow-[0_20px_50px_-20px_rgba(27,42,74,0.25)] transition-shadow"
            >
              <div
                className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: `${GOLD}1A`, color: GOLD }}
              >
                <it.icon size={22} />
              </div>
              <h3
                className="font-display text-2xl text-navy"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                {it.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StartCreatingCTA() {
  return (
    <section className="relative overflow-hidden bg-gold py-14 md:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-white/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <h2
          className="text-3xl md:text-5xl text-navy"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Start building your vault today.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base md:text-lg text-navy/80">
          Apply in minutes, get reviewed in 48 hours, and publish your first digital product this week.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/sell"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-navy px-8 py-4 text-sm font-bold text-gold transition-all hover:shadow-[0_18px_40px_-12px_rgba(27,42,74,0.5)] active:scale-[0.98]"
          >
            Start My Creator Setup
            <ArrowRight size={16} />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center rounded-full border-2 border-navy/40 px-8 py-4 text-sm font-bold text-navy hover:bg-navy hover:text-gold transition-colors"
          >
            See How It Works
          </a>
        </div>
      </div>
    </section>
  );
}

function PreSetupFAQ() {
  const items = [
    { q: "Do I need a large audience to apply?", a: "No. We review your product quality and brand fit, not your follower count." },
    { q: "What digital products can I sell?", a: "eBooks, AI prompt packs, journals, and planners — any digital product that fits our curated standard." },
    { q: "How much does AurumVault keep per sale?", a: "You keep 85% of every sale. AurumVault takes a 15% platform fee — no monthly or listing fees." },
    { q: "How long until my first product is live?", a: "Applications are reviewed within 48 hours. Once approved, you can publish in minutes." },
    { q: "Do I keep ownership of my work?", a: "Yes. You retain full rights to your content. AurumVault is a distribution license, not an assignment." },
  ];
  return (
    <section className="bg-white py-14 md:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-ink">Before You Start</p>
          <h2
            className="mt-2 text-3xl md:text-5xl text-navy"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Quick answers.
          </h2>
        </div>
        <div className="mt-10 divide-y divide-ink/10 border-y border-ink/10">
          {items.map((it) => (
            <details key={it.q} className="group py-5">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-navy">
                {it.q}
                <span className="text-gold-ink transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Apply in 2 minutes", body: "Tell us about your brand, what you sell, and where to reach you. Four short steps." },
    { n: "02", title: "Get approved within 48 hours", body: "Our team reviews every application to keep the marketplace curated and premium." },
    { n: "03", title: "Upload & start selling", body: "Use our AI-powered tools to create covers, copy, and pricing. Publish in minutes." },
  ];
  return (
    <section id="how-it-works" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-ink">The Path</p>
          <h2
            className="mt-2 text-3xl md:text-5xl text-navy"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            From application to first sale.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-2xl bg-paper border border-ink/10 p-8">
              <div
                className="font-display text-5xl"
                style={{ color: `${GOLD}80`, fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                {s.n}
              </div>
              <h3
                className="mt-3 font-display text-2xl text-navy"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhatToSell() {
  const items = [
    { icon: BookOpen, label: "eBooks" },
    { icon: Sparkles, label: "AI Prompt Packs" },
    { icon: BookOpen, label: "Journals" },
    { icon: BarChart3, label: "Financial Planners" },
  ];
  return (
    <section className="bg-paper py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-ink">Product Types</p>
          <h2
            className="mt-2 text-3xl md:text-5xl text-navy"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            What can you sell?
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((it) => (
            <div
              key={it.label}
              className="flex items-center gap-4 rounded-2xl bg-white border border-ink/10 p-5"
            >
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: `${NAVY}0d`, color: NAVY }}
              >
                <it.icon size={20} />
              </span>
              <span className="font-semibold text-navy">{it.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CreatorTools() {
  const items = [
    { icon: Sparkles, title: "AI Copy Assistant", body: "Product descriptions, taglines, SEO copy, and cover design briefs — written for you in AI Studio." },
    { icon: BarChart3, title: "Revenue Analytics", body: "Real-time earnings, units sold, and top products in your dashboard." },
    { icon: Crown, title: "Featured Placement", body: "Kingdom Picks and curated shelves surface your best work." },
    { icon: ShieldCheck, title: "Secure Delivery", body: "Tokenized, expiring download links protect your files on every sale." },
    { icon: Wand2, title: "AI Cover Generator", body: "One-click premium cover art, no design skills required.", soon: true },
    { icon: Mail, title: "Buyer Email Capture", body: "Grow and export your own buyer list on every sale.", soon: true },
  ];
  return (
    <section
      className="py-16 md:py-24 text-white relative overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-0 h-[500px] w-[500px] rounded-full blur-3xl"
        style={{ background: `${GOLD}22` }}
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: GOLD }}>
            Creator Studio
          </p>
          <h2
            className="mt-2 text-3xl md:text-5xl"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Tools that treat you like the CEO.
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-2xl border p-6"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg"
                style={{ background: `${GOLD}1A`, color: GOLD }}
              >
                <it.icon size={20} />
              </div>
              <h3 className="font-display text-xl flex items-center gap-2 flex-wrap" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                {it.title}
                {"soon" in it && it.soon ? (
                  <span
                    className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ borderColor: `${GOLD}66`, color: GOLD, fontFamily: "inherit" }}
                  >
                    Coming soon
                  </span>
                ) : null}
              </h3>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    { q: "How much does it cost to sell?", a: "Nothing upfront. AurumVault takes a 15% platform fee on each sale; you keep 85%. No monthly fees, no listing fees." },
    { q: "How fast is the review process?", a: "We review every application within 48 hours. Once approved, you can upload products immediately." },
    { q: "How do I get paid?", a: "Earnings accumulate in your seller balance and are paid out on the schedule shown in your dashboard, once past our clearance window." },
    { q: "What can I sell?", a: "eBooks, AI prompt packs, journals, and financial planners — any digital product that fits our curated, purpose-driven standard." },
    { q: "Do I own my content?", a: "Always. You retain full rights to your work. AurumVault is a distribution license, not an assignment." },
    { q: "What's the quality bar?", a: "Every product is reviewed for craft, originality, and value. We keep the marketplace curated so buyers trust it — and so your work stands out." },
  ];
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-ink">Questions</p>
          <h2
            className="mt-2 text-3xl md:text-5xl text-navy"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            The essentials.
          </h2>
        </div>
        <div className="mt-10 divide-y divide-ink/10 border-y border-ink/10">
          {items.map((it) => (
            <details key={it.q} className="group py-5">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-navy">
                {it.q}
                <span className="text-gold-ink transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section
      className="py-20 md:py-28 text-center text-white relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: `${GOLD}33` }}
      />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        <h2
          className="text-3xl md:text-5xl"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Ready to build your vault?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-white/75">
          Apply in 2 minutes. Get reviewed in 48 hours. Start selling this week.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/sell"
            className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-bold hover:shadow-[0_18px_40px_-12px_rgba(201,168,76,0.6)]"
            style={{ background: GOLD, color: NAVY }}
          >
            Apply to Sell <ArrowRight size={16} />
          </Link>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Check size={14} style={{ color: GOLD }} /> No fees to apply
            <span className="mx-2">·</span>
            <Check size={14} style={{ color: GOLD }} /> 48-hour review
          </div>
        </div>
      </div>
    </section>
  );
}
