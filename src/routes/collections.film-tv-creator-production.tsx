import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Film } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { CategoryLineIcon } from "@/components/marketplace/CategoryIcons";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { getProducts } from "@/lib/marketplace.functions";
import { subcategoriesQuery } from "@/lib/subcategories";
import {
  CREATOR_SYSTEMS_COLLECTION,
  FILM_TV_LABEL,
  FILM_TV_SLUG,
  FILM_TV_SUBCATEGORIES,
  FILM_TV_SUBTITLE,
  FLAGSHIP_SYSTEM,
} from "@/lib/creator-production";

const CANONICAL =
  "https://www.aurumvault.store/collections/film-tv-creator-production";
const SEO_TITLE = "Film, TV & Creator Production Tools | AurumVault";
const SEO_DESC =
  "Professional creator systems for vertical microdramas, independent film, reality TV, YouTube, social video, AI production, pitching, distribution, and entertainment business.";

export const Route = createFileRoute("/collections/film-tv-creator-production")({
  head: () => ({
    meta: [
      { title: SEO_TITLE },
      { name: "description", content: SEO_DESC },
      { property: "og:title", content: SEO_TITLE },
      { property: "og:description", content: SEO_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: FILM_TV_LABEL,
          description: SEO_DESC,
          url: CANONICAL,
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
              item: "https://www.aurumvault.store/",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Products",
              item: "https://www.aurumvault.store/products",
            },
            {
              "@type": "ListItem",
              position: 3,
              name: FILM_TV_LABEL,
              item: CANONICAL,
            },
          ],
        }),
      },
    ],
  }),
  component: FilmTvCreatorProductionPage,
});

function GoldRule({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block h-px w-24 bg-gradient-to-r from-transparent via-gold/70 to-transparent ${className}`}
    />
  );
}

function FilmTvCreatorProductionPage() {
  const { data: managed } = useQuery(subcategoriesQuery);
  const liveSubs = new Set(
    (managed ?? [])
      .filter((s) => s.category_slug === FILM_TV_SLUG)
      .map((s) => s.name),
  );
  const cards = FILM_TV_SUBCATEGORIES.filter(
    (c) => liveSubs.size === 0 || liveSubs.has(c.name),
  );

  // Live listings in the department, if any exist yet. No placeholder rows.
  const { data: listing } = useQuery({
    queryKey: ["film-tv-products"],
    queryFn: () =>
      getProducts({ data: { category: FILM_TV_SLUG, pageSize: 12, page: 1 } }),
    staleTime: 60_000,
  });
  const products = listing?.items ?? [];
  const flagship = products.find((p) =>
    p.title.toLowerCase().startsWith("vertical microdrama creator os"),
  );

  return (
    <MarketShell>
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #06070C 0%, #0D1424 58%, #2A2412 100%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(201,162,39,0.55) 1px, transparent 0)",
              backgroundSize: "26px 26px",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-caps text-gold">
              <Film size={12} aria-hidden /> New Department
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold leading-[1.08] text-white sm:text-4xl md:text-5xl">
              Build the story.
              <br />
              Run the production.
              <br />
              <span className="text-gold">Grow the IP.</span>
            </h1>
            <GoldRule className="mt-5" />
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/80 md:text-base">
              Professional creator systems for vertical series, independent
              film, reality TV, YouTube, social video, music, AI-assisted
              production, pitching, distribution, and entertainment business.
            </p>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              {FILM_TV_SUBTITLE}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="#creator-systems"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-[13px] font-bold uppercase tracking-caps text-navy transition hover:brightness-105"
              >
                Explore Creator Systems <ArrowRight size={15} aria-hidden />
              </a>
              <Link
                to="/products"
                search={{ category: FILM_TV_LABEL } as never}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-6 py-3 text-[13px] font-bold uppercase tracking-caps text-white transition hover:border-gold/70 hover:text-gold"
              >
                Browse All Film &amp; TV Tools
              </Link>
            </div>
          </div>
        </section>

        {/* Featured creator system */}
        <section
          id="creator-systems"
          className="border-b border-white/10 bg-[#080A11]"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
            <h2 className="font-display text-[11px] font-bold uppercase tracking-caps text-gold">
              Featured Creator System
            </h2>
            <div className="mt-5 grid gap-8 rounded-2xl border border-gold/25 bg-white/[0.03] p-5 md:grid-cols-[1.15fr_1fr] md:p-8">
              <div className="min-w-0">
                <span className="inline-block rounded-sm border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-gold">
                  {CREATOR_SYSTEMS_COLLECTION}
                </span>
                <h3 className="mt-3 font-display text-2xl font-bold leading-tight text-white md:text-3xl">
                  {FLAGSHIP_SYSTEM.title}
                </h3>
                <p className="mt-2 text-sm text-white/70">
                  {FLAGSHIP_SYSTEM.subtitle}
                </p>
                <p className="mt-4 text-[15px] leading-relaxed text-white/80">
                  {FLAGSHIP_SYSTEM.body}
                </p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {FLAGSHIP_SYSTEM.highlights.map((h) => (
                    <li
                      key={h}
                      className="flex items-start gap-2 text-[13px] text-white/75"
                    >
                      <span
                        aria-hidden
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                      />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col justify-between gap-5 rounded-xl border border-white/10 bg-[#0C1120] p-5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-caps text-white/50">
                    {FILM_TV_LABEL}
                  </div>
                  <div className="mt-1 text-[12px] text-white/50">
                    {FLAGSHIP_SYSTEM.subcategory}
                  </div>
                  <div className="mt-4 font-display text-3xl font-bold text-gold">
                    {FLAGSHIP_SYSTEM.priceLabel}
                  </div>
                </div>
                {flagship ? (
                  <Link
                    to="/products/$id"
                    params={{ id: flagship.id }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-[13px] font-bold uppercase tracking-caps text-navy transition hover:brightness-105"
                  >
                    View Creator OS <ArrowRight size={15} aria-hidden />
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <span className="flex w-full items-center justify-center rounded-full border border-gold/40 bg-gold/10 px-5 py-3 text-[13px] font-bold uppercase tracking-caps text-gold">
                      Releasing Soon
                    </span>
                    <p className="text-center text-[12px] text-white/50">
                      The listing goes live once its production files are
                      uploaded.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Subcategory discovery */}
        <section className="border-b border-white/10 bg-[#0A0D17]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
              Explore the department
            </h2>
            <GoldRule className="mt-3" />
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => (
                <Link
                  key={c.name}
                  to="/products"
                  search={{ category: FILM_TV_LABEL, sub: c.name } as never}
                  className="group flex min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-gold/55 hover:bg-white/[0.06] focus-visible:border-gold focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-gold/25 bg-gold/10"
                  >
                    <CategoryLineIcon slug={FILM_TV_SLUG} className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 font-display text-[17px] font-bold leading-snug text-white">
                    {c.name}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">
                    {c.blurb}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-caps text-gold">
                    Browse{" "}
                    <ArrowRight
                      size={13}
                      aria-hidden
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Live listings in the department, when they exist */}
        {products.length > 0 && (
          <section className="border-b border-white/10 bg-[#080A11]">
            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
              <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
                In this department
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Final CTA */}
        <section className="bg-gradient-to-r from-[#0B1020] via-[#141024] to-[#2A2412]">
          <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 md:py-18 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
              Run your creative work like a production company.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] text-white/75">
              Development, production, budgeting, pitching, distribution,
              marketing, analytics, and AI workflows — organized into systems you
              can actually operate.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/products"
                search={{ category: FILM_TV_LABEL } as never}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-[13px] font-bold uppercase tracking-caps text-navy transition hover:brightness-105"
              >
                Browse Film &amp; TV Tools <ArrowRight size={15} aria-hidden />
              </Link>
              <Link
                to="/academy"
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-[13px] font-bold uppercase tracking-caps text-white transition hover:border-gold/70 hover:text-gold"
              >
                Visit AurumVault Academy
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketShell>
  );
}
