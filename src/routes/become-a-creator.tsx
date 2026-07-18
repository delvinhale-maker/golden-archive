import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  DollarSign,
  Users,
  BookOpen,
  GraduationCap,
  LayoutTemplate,
  Music,
  Palette,
  Wand2,
  BarChart3,
  Mail,
  ShieldCheck,
  Crown,
  Check,
} from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";

// TODO: replace with real numbers once available.
const SOCIAL_PROOF = {
  creators: "120+",
  productsSold: "2,400+",
  countries: "38",
};

const NAVY = "#1B2A4A";
const NAVY_DEEP = "#11192E";
const GOLD = "#C9A84C";

export const Route = createFileRoute("/become-a-creator")({
  head: () => ({
    meta: [
      { title: "Become a Creator on AurumVault | Sell Digital Products & Keep 85%" },
      {
        name: "description",
        content:
          "Join the most curated digital marketplace for purpose-driven creators. Keep 85% of every sale. AI-powered tools, built-in Kingdom-minded audience, 48-hour review.",
      },
      { property: "og:title", content: "Your Knowledge. Your Empire. Your Vault." },
      {
        property: "og:description",
        content:
          "Join the most curated digital marketplace for purpose-driven creators. Keep 85% of every sale.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.aurumvault.store/become-a-creator" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Become a Creator on AurumVault" },
      {
        name: "twitter:description",
        content:
          "Keep 85% of every sale. AI-powered tools. Kingdom-minded audience.",
      },
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
      <SocialProof />
      <ValueProps />
      <HowItWorks />
      <WhatToSell />
      <CreatorTools />
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
          <Crown size={12} /> For Purpose-Driven Creators
        </div>
        <h1
          className="mx-auto max-w-4xl text-4xl leading-[1.05] text-white sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Your Knowledge.
          <br />
          Your Empire.{" "}
          <span className="italic" style={{ color: GOLD }}>
            Your Vault.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base md:text-lg text-white/75">
          Join the most curated digital marketplace for purpose-driven creators.
          Keep <strong className="text-white">85%</strong> of every sale. Reach a
          Kingdom-minded audience ready to buy.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/sell"
            className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-bold transition-all hover:shadow-[0_18px_40px_-12px_rgba(201,168,76,0.6)] active:scale-[0.98]"
            style={{ background: GOLD, color: NAVY }}
          >
            Apply to Sell
            <ArrowRight size={16} />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center rounded-full border-2 border-white/40 px-8 py-4 text-sm font-bold text-white hover:bg-white hover:text-navy transition-colors"
          >
            See How It Works
          </a>
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  const items = [
    { value: SOCIAL_PROOF.creators, label: "Creators earning on AurumVault" },
    { value: SOCIAL_PROOF.productsSold, label: "Products sold" },
    { value: SOCIAL_PROOF.countries, label: "Countries reached" },
  ];
  return (
    <section className="bg-white border-b border-ink/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 grid grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.label} className="text-center">
            <div
              className="font-display text-2xl md:text-4xl"
              style={{ color: NAVY, fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              {it.value}
            </div>
            <div className="mt-1 text-[10px] md:text-xs uppercase tracking-[0.18em] text-mute">
              {it.label}
            </div>
          </div>
        ))}
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
    { icon: GraduationCap, label: "Online Courses" },
    { icon: LayoutTemplate, label: "Templates & Kits" },
    { icon: Music, label: "Audio & Music" },
    { icon: Palette, label: "Design Assets" },
    { icon: Sparkles, label: "Coaching & Guides" },
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
    { icon: Wand2, title: "AI Cover Generator", body: "Premium covers in seconds. No design skills required." },
    { icon: Sparkles, title: "Copy Assistant", body: "Product descriptions, taglines, and SEO — written for you." },
    { icon: BarChart3, title: "Revenue Analytics", body: "Real-time earnings, conversion funnels, top products." },
    { icon: Mail, title: "Buyer Email Capture", body: "Grow your list on every sale. Own your audience." },
    { icon: ShieldCheck, title: "Fraud Protection", body: "Secure downloads, chargeback defense, verified buyers." },
    { icon: Crown, title: "Featured Placement", body: "Kingdom Picks and curated shelves surface your best work." },
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
              <h3 className="font-display text-xl" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                {it.title}
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
    { q: "What can I sell?", a: "eBooks, courses, templates, design assets, audio, coaching guides — any digital product that fits our curated, purpose-driven standard." },
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
