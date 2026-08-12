import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { CategoryLineIcon } from "@/components/marketplace/CategoryIcons";
import { subcategoriesQuery } from "@/lib/subcategories";
import { SUBCATEGORIES } from "@/lib/categories";

export const Route = createFileRoute("/caption-templates")({
  head: () => ({
    meta: [
      { title: "Caption Templates — Niche Social Media Caption Systems | AurumVault" },
      {
        name: "description",
        content:
          "Professionally structured, niche-specific caption collections for realtors, beauty pros, digital sellers, credit educators, authors, and more. Done-for-you starting points, personalized by you.",
      },
      {
        property: "og:title",
        content: "Caption Templates — AurumVault",
      },
      {
        property: "og:description",
        content:
          "Never start with a blank caption again. Niche caption systems built to help you educate, engage, promote, and stay visible.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CaptionTemplatesPage,
});

// Display cards for the visual grid. `sub` matches the managed subcategory
// name so each card deep-links into the storefront filter.
const CARDS: { title: string; sub: string; note: string }[] = [
  { title: "Real Estate", sub: "Realtor Caption Templates", note: "Buyers, sellers, listings, market moments" },
  { title: "Beauty", sub: "Beauty Business Caption Templates", note: "Booking, aftercare, before & after" },
  { title: "Digital Products", sub: "Digital Product Seller Caption Templates", note: "Launches, benefits, objections" },
  { title: "Credit & Finance", sub: "Credit & Finance Caption Templates", note: "Education-first, compliance-minded" },
  { title: "Authors", sub: "Author & KDP Caption Templates", note: "Launch, excerpts, author story" },
  { title: "Faith & Business", sub: "Faith-Based Entrepreneur Caption Templates", note: "Purpose, stewardship, leadership" },
  { title: "Photography", sub: "Photographer Caption Templates", note: "Sessions, behind the scenes, booking" },
  { title: "Coaching", sub: "Coach Caption Templates", note: "Authority, transformation, offers" },
  { title: "Boutiques", sub: "Boutique Caption Templates", note: "New arrivals, restocks, styling" },
  { title: "Restaurants", sub: "Restaurant Caption Templates", note: "Specials, menu drops, community" },
];

const PLACEHOLDERS = [
  "[CITY]",
  "[BUSINESS NAME]",
  "[SERVICE]",
  "[PRODUCT]",
  "[PRICE]",
  "[CLIENT TYPE]",
  "[RESULT]",
  "[FEATURE]",
  "[DATE]",
  "[LOCATION]",
  "[CALL TO ACTION]",
];

function GoldRule({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block h-px w-24 bg-gradient-to-r from-transparent via-gold/70 to-transparent ${className}`}
    />
  );
}

function CaptionTemplatesPage() {
  const { data: managed } = useQuery(subcategoriesQuery);
  const liveSubs = new Set(
    (managed ?? [])
      .filter((s) => s.category_slug === "caption_templates")
      .map((s) => s.name),
  );
  const fallback = new Set(SUBCATEGORIES.caption_templates ?? []);
  const cards = CARDS.filter((c) => liveSubs.has(c.sub) || fallback.has(c.sub));

  return (
    <MarketShell>
      <main className="scheme-surface-bg" style={{ backgroundColor: "var(--scheme-bg)" }}>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #060A14 0%, #101A31 55%, #1E2A48 100%)",
            }}
          />
          <div className="relative mx-auto max-w-5xl px-5 py-14 text-center sm:px-8 sm:py-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
              Caption Templates
            </p>
            <h1 className="mt-4 font-display text-3xl leading-[1.15] text-white sm:text-5xl">
              Never Start With a Blank Caption Again.
            </h1>
            <GoldRule className="mx-auto my-6" />
            <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-white/75 sm:text-lg">
              Professionally structured, niche-specific caption collections created to
              help you educate, engage, promote, and stay visible online.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/products"
                search={{ category: "Caption Templates" } as never}
                data-tab-cta="solid"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold sm:w-auto"
              >
                Explore Caption Templates <ArrowRight size={16} />
              </Link>
              <a
                href="#collections"
                className="inline-flex w-full items-center justify-center rounded-full border border-gold/40 px-6 py-3 text-sm font-medium text-white/85 hover:bg-white/5 sm:w-auto"
              >
                Browse by niche
              </a>
            </div>
          </div>
        </section>

        {/* Positioning */}
        <section className="border-b border-white/10 px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-2xl text-white sm:text-3xl">
              Captions Created for the Business Behind the Post
            </h2>
            <GoldRule className="mx-auto my-5" />
            <p className="text-[15px] leading-relaxed text-white/75">
              Stop wondering what to say. AurumVault Caption Templates give professionals
              and business owners ready-to-customize social media content built around the
              conversations their customers actually care about.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-white/70">
              From educational posts and sales captions to engagement prompts,
              storytelling, authority-building content, and strategic calls to action,
              each collection is designed to help you post more consistently while
              spending less time writing.
            </p>
            <p className="mt-6 font-display text-lg text-gold">
              Done-for-you starting points. Personalized by you.
            </p>
            <p className="text-[13px] text-white/60">
              Built to save you time without removing your voice.
            </p>
          </div>
        </section>

        {/* Category grid */}
        <section id="collections" className="px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-2xl text-white sm:text-3xl">
              Browse by niche
            </h2>
            <GoldRule className="my-5" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => (
                <Link
                  key={c.sub}
                  to="/products"
                  search={{ category: "Caption Templates", sub: c.sub } as never}
                  className="group flex items-start gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-gold/50 hover:bg-white/[0.06]"
                >
                  <CategoryLineIcon slug="caption_templates" className="h-9 w-9 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/90">
                      Caption Templates
                    </span>
                    <span className="mt-1 block font-display text-lg text-white">
                      {c.title}
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug text-white/60">
                      {c.note}
                    </span>
                  </span>
                  <ArrowRight
                    size={16}
                    className="ml-auto mt-1 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-gold"
                  />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Customization system */}
        <section className="border-t border-white/10 px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-2xl text-white sm:text-3xl">
              A simple customization system
            </h2>
            <GoldRule className="my-5" />
            <p className="text-[15px] leading-relaxed text-white/70">
              Every collection uses standardized placeholders. Replace them with your own
              details before publishing so each caption sounds like you.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {PLACEHOLDERS.map((p) => (
                <li
                  key={p}
                  className="rounded-full border border-gold/30 px-3 py-1 font-mono text-[12px] text-gold/90"
                >
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[13px] text-white/55">
              Delivered as PDF, with optional editable DOCX where the creator provides it.
            </p>
          </div>
        </section>
      </main>
    </MarketShell>
  );
}
