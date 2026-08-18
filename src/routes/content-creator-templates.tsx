import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarRange,
  GraduationCap,
  IdCard,
  Mic,
  MessageSquareQuote,
} from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";

const CANONICAL = "https://www.aurumvault.store/content-creator-templates";
const TITLE = "Content Creator Templates & Digital Resources | AurumVault";
const DESCRIPTION =
  "Shop premium content creator templates, media kits, caption resources, podcast tools, content planners, and digital resources for creators and entrepreneurs.";

export const Route = createFileRoute("/content-creator-templates")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Content Creator Templates & Digital Resources",
          description: DESCRIPTION,
          url: CANONICAL,
          isPartOf: {
            "@type": "WebSite",
            name: "AurumVault",
            url: "https://www.aurumvault.store",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://www.aurumvault.store",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Content Creator Templates & Digital Resources",
              item: CANONICAL,
            },
          ],
        }),
      },
    ],
  }),
  component: ContentCreatorTemplatesPage,
});

const CARDS = [
  {
    icon: IdCard,
    title: "Media Kit Templates",
    body:
      "Present your audience, brand, services, and partnership value with a polished creator media kit.",
    cta: "Browse Media Kits",
    search: { q: "media kit" },
  },
  {
    icon: MessageSquareQuote,
    title: "Caption & Social Media Templates",
    body:
      "Create stronger posts faster with ready-to-use caption frameworks and social content resources.",
    cta: "Explore Caption Templates",
    search: { category: "caption_templates" },
  },
  {
    icon: Mic,
    title: "Podcast Creator Resources",
    body:
      "Plan episodes, package your show, and promote new content with practical podcast-ready resources.",
    cta: "Browse Podcast Resources",
    search: { q: "podcast" },
  },
  {
    icon: CalendarRange,
    title: "Content Planning Tools",
    body:
      "Turn ideas into a repeatable publishing system with planners, calendars, and creator workflow tools.",
    cta: "Explore Planning Tools",
    search: { category: "financial_planners", sub: "Life & Productivity Planners" },
  },
] as const;

const BENEFITS = [
  "Spend less time starting from a blank page",
  "Keep your brand presentation more consistent",
  "Organize ideas, campaigns, and collaborations",
  "Create professional assets without rebuilding everything from scratch",
  "Use practical resources designed for real creator workflows",
  "Access digital products online without waiting for shipping",
];

const FAQS = [
  {
    q: "What are content creator templates?",
    a: "Content creator templates are reusable digital resources that help you plan, organize, present, or promote your work — media kits, caption frameworks, content planners, podcast resources, and social media templates you can adapt to your own brand instead of building each asset from scratch.",
  },
  {
    q: "Who are AurumVault creator resources for?",
    a: "They are made for content creators, influencers, podcasters, entrepreneurs, personal brands, freelancers, and small businesses that publish regularly and want a more organized, professional workflow.",
  },
  {
    q: "Are these physical products?",
    a: "AurumVault primarily offers digital resources. Each product page explains the included formats and compatibility so you know exactly what you are getting before you buy.",
  },
  {
    q: "Can I find educational content for creators too?",
    a: "Yes. AurumVault Academy publishes educational articles covering digital entrepreneurship, business, AI, productivity, content creation, and related topics — useful context before choosing a tool.",
  },
];

function Eyebrow({ children, tone = "gold" }: { children: string; tone?: "gold" | "ink" }) {
  return (
    <p
      className={`text-[11px] font-bold uppercase tracking-caps ${
        tone === "gold" ? "text-gold" : "text-gold-ink"
      }`}
    >
      {children}
    </p>
  );
}

function ContentCreatorTemplatesPage() {
  return (
    <MarketShell>
      {/* Hero */}
      <section className="bg-navy">
        <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-24">
          <Eyebrow>Premium Digital Creator Resources</Eyebrow>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-white md:text-5xl">
            Content Creator Templates &amp; Digital Resources
          </h1>
          <div className="mt-5 h-px w-24 bg-gold/70" />
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
            Build a more professional, organized, and consistent creator business with curated media
            kits, caption templates, podcast resources, content planners, and digital tools designed
            for modern creators.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/products"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-gold px-7 text-sm font-bold text-navy"
            >
              Shop Creator Resources
            </Link>
            <Link
              to="/academy"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-gold/60 px-7 text-sm font-bold text-gold"
            >
              Explore the Academy
            </Link>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="bg-background">
        <div className="mx-auto max-w-3xl px-5 py-14 md:px-8 md:py-20">
          <Eyebrow tone="ink">Creator Resources</Eyebrow>
          <h2 className="mt-3 font-display text-2xl font-bold text-ink md:text-3xl">
            Build your content system, not just your next post
          </h2>
          <p className="mt-4 text-base leading-relaxed text-mute">
            AurumVault brings together premium digital resources for creators who want to save time,
            present their work professionally, and build a more consistent content workflow.
          </p>
        </div>
      </section>

      {/* Resource cards */}
      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-5 pb-16 md:px-8 md:pb-20">
          <div className="grid gap-5 sm:grid-cols-2">
            {CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="flex flex-col rounded-xl border border-line bg-white p-6"
                >
                  <Icon size={22} className="text-gold-ink" aria-hidden />
                  <h3 className="mt-4 font-display text-lg font-bold text-ink">{card.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-mute">{card.body}</p>
                  <Link
                    to="/products"
                    search={card.search as never}
                    className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-gold-ink hover:underline"
                  >
                    {card.cta} →
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why AurumVault */}
      <section style={{ backgroundColor: "var(--accent-cream)" }}>
        <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
          <Eyebrow tone="ink">Why AurumVault</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-display text-2xl font-bold text-ink md:text-3xl">
            Templates should remove friction from your creative work
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-mute">
            Good creator resources do more than look attractive. They help you move from idea to
            execution faster while keeping your content, brand, and business organized.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <li
                key={b}
                className="rounded-lg border border-line/70 bg-white/70 p-4 text-sm leading-relaxed text-ink"
              >
                {b}
              </li>
            ))}
          </ul>
          <Link
            to="/products"
            className="mt-9 inline-flex min-h-12 items-center justify-center rounded-full bg-navy px-7 text-sm font-bold text-white"
          >
            Browse the Marketplace
          </Link>
        </div>
      </section>

      {/* Academy */}
      <section className="bg-navy-2">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-[1.4fr_1fr] md:px-8 md:py-20">
          <div>
            <Eyebrow>Learn before you buy</Eyebrow>
            <h2 className="mt-3 font-display text-2xl font-bold text-white md:text-3xl">
              Turn creator education into better buying decisions
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80">
              AurumVault Academy publishes practical educational content on digital
              entrepreneurship, content creation, business, AI, productivity, and more. Use the
              Academy to learn the strategy, then find the tools that help you put it into practice.
            </p>
            <Link
              to="/academy"
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-gold px-7 text-sm font-bold text-navy"
            >
              Visit AurumVault Academy
            </Link>
          </div>
          <div className="flex flex-col justify-center rounded-xl border border-gold/30 p-7">
            <GraduationCap size={26} className="text-gold" aria-hidden />
            <p className="mt-4 font-display text-2xl font-bold text-white">Learn. Build. Grow.</p>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Editorial guides on content creation resources and creator business tools, published
              alongside the marketplace.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold">
              <BookOpen size={14} aria-hidden /> AurumVault Academy
            </span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-background">
        <div className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-20">
          <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
            Creator template questions, answered
          </h2>
          <div className="mt-8 space-y-6">
            {FAQS.map((f) => (
              <div key={f.q} className="rounded-lg border border-line bg-white p-5">
                <h3 className="font-display text-base font-bold text-ink">{f.q}</h3>
                <p className="mt-2 break-words text-sm leading-relaxed text-mute">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ backgroundColor: "var(--accent-cream)" }}>
        <div className="mx-auto max-w-3xl px-5 py-16 text-center md:px-8 md:py-20">
          <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
            Find the right creator resource for your next move
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-mute">
            Explore premium digital products for content planning, brand presentation, social media,
            podcasting, and creator growth.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/products"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-gold px-7 text-sm font-bold text-navy"
            >
              Explore Creator Resources
            </Link>
            <Link
              to="/academy"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-navy/25 px-7 text-sm font-bold text-navy"
            >
              Read the Academy
            </Link>
          </div>
        </div>
      </section>
    </MarketShell>
  );
}
