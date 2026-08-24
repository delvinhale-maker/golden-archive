import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2 } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { CategoryLineIcon } from "@/components/marketplace/CategoryIcons";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { getProducts } from "@/lib/marketplace.functions";
import { subcategoriesQuery } from "@/lib/subcategories";
import {
  BUSINESS_SYSTEMS_FLAGSHIP,
  BUSINESS_SYSTEMS_LABEL,
  BUSINESS_SYSTEMS_POSITIONING,
  BUSINESS_SYSTEMS_SLUG,
  BUSINESS_SYSTEMS_TAGLINE,
  BUSINESS_SYSTEM_SUBS,
} from "@/lib/business-systems";

const CANONICAL = "https://www.aurumvault.store/business-systems";
const SEO_TITLE = "Business Systems | AI, Marketing & Operations Tools | AurumVault";
const SEO_DESC =
  "Explore ready-to-use AurumVault Business Systems for AI, marketing, sales, customer service, operations, creators, and business planning.";

export const Route = createFileRoute("/business-systems")({
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
          name: `AurumVault ${BUSINESS_SYSTEMS_LABEL}`,
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
              name: BUSINESS_SYSTEMS_LABEL,
              item: CANONICAL,
            },
          ],
        }),
      },
    ],
  }),
  component: BusinessSystemsPage,
});

function GoldRule({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block h-px w-24 bg-gradient-to-r from-transparent via-gold/70 to-transparent ${className}`}
    />
  );
}

const ALL_FILTER = "All Business Systems";
const FILTERS = [ALL_FILTER, ...BUSINESS_SYSTEM_SUBS.map((s) => s.filter)] as const;

function BusinessSystemsPage() {
  const [filter, setFilter] = useState<string>(ALL_FILTER);

  const { data: managed } = useQuery(subcategoriesQuery);
  const liveSubs = new Set(
    (managed ?? [])
      .filter((s) => s.category_slug === BUSINESS_SYSTEMS_SLUG)
      .map((s) => s.name),
  );
  const cards = BUSINESS_SYSTEM_SUBS.filter(
    (c) => liveSubs.size === 0 || liveSubs.has(c.name),
  );

  const { data: listing } = useQuery({
    queryKey: ["business-systems-products"],
    queryFn: () =>
      getProducts({
        data: { category: BUSINESS_SYSTEMS_SLUG, pageSize: 24, page: 1 },
      }),
    staleTime: 60_000,
  });
  const products = listing?.items ?? [];

  const flagship = products.find((p) =>
    p.title.toLowerCase().includes(BUSINESS_SYSTEMS_FLAGSHIP.titleMatch),
  );

  const visible = useMemo(() => {
    if (filter === ALL_FILTER) return products;
    const sub = BUSINESS_SYSTEM_SUBS.find((s) => s.filter === filter);
    if (!sub) return products;
    return products.filter((p) => (p.subcategory ?? "") === sub.name);
  }, [products, filter]);

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
                "linear-gradient(135deg, #05070C 0%, #0B1424 58%, #241E10 100%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-caps text-gold">
              <Building2 size={12} aria-hidden /> AurumVault {BUSINESS_SYSTEMS_LABEL}
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold leading-[1.1] text-white sm:text-4xl md:text-5xl">
              Ready-to-Use <span className="text-gold">Business Systems</span>
            </h1>
            <GoldRule className="mt-5" />
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/80 md:text-base">
              Practical digital systems built to help you organize marketing,
              sales, customer service, operations, planning, and more.
            </p>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              {BUSINESS_SYSTEMS_TAGLINE} — {BUSINESS_SYSTEMS_POSITIONING}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="#systems"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-[13px] font-bold uppercase tracking-caps text-navy transition hover:brightness-105"
              >
                Explore Business Systems <ArrowRight size={15} aria-hidden />
              </a>
              <Link
                to="/products"
                search={{ category: BUSINESS_SYSTEMS_LABEL } as never}
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-[13px] font-bold uppercase tracking-caps text-white transition hover:border-gold/70 hover:text-gold"
              >
                Browse All Systems
              </Link>
            </div>
          </div>
        </section>

        {/* Intro */}
        <section className="border-b border-white/10 bg-[#080A11]">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
              {BUSINESS_SYSTEMS_TAGLINE}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/75">
              Go beyond individual prompts and templates. AurumVault Business
              Systems combine workflows, prompts, dashboards, planning tools,
              and practical implementation resources designed to help
              entrepreneurs organize and run real business functions.
            </p>
          </div>
        </section>

        {/* Featured system */}
        <section id="systems" className="border-b border-white/10 bg-[#0A0D17]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
            <h2 className="font-display text-[11px] font-bold uppercase tracking-caps text-gold">
              Featured System
            </h2>
            <div className="mt-5 grid gap-8 rounded-2xl border border-gold/25 bg-white/[0.03] p-5 md:grid-cols-[1.15fr_1fr] md:p-8">
              <div className="min-w-0">
                <span className="inline-block rounded-sm border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-gold">
                  Complete Business System
                </span>
                <h3 className="mt-3 font-display text-2xl font-bold leading-tight text-white md:text-3xl">
                  {BUSINESS_SYSTEMS_FLAGSHIP.title}
                </h3>
                <p className="mt-2 text-sm text-white/70">
                  {BUSINESS_SYSTEMS_FLAGSHIP.subtitle}
                </p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {BUSINESS_SYSTEMS_FLAGSHIP.highlights.map((h) => (
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
                    {BUSINESS_SYSTEMS_LABEL}
                  </div>
                  <div className="mt-1 text-[12px] text-white/50">
                    {BUSINESS_SYSTEMS_FLAGSHIP.subcategory}
                  </div>
                  {flagship && (
                    <div className="mt-4 font-display text-3xl font-bold text-gold">
                      ${flagship.price.toFixed(2)}
                    </div>
                  )}
                </div>
                {flagship ? (
                  <Link
                    to="/products/$id"
                    params={{ id: flagship.id }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-[13px] font-bold uppercase tracking-caps text-navy transition hover:brightness-105"
                  >
                    View the Complete System <ArrowRight size={15} aria-hidden />
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <span className="flex w-full items-center justify-center rounded-full border border-gold/40 bg-gold/10 px-5 py-3 text-[13px] font-bold uppercase tracking-caps text-gold">
                      Releasing Soon
                    </span>
                    <p className="text-center text-[12px] text-white/50">
                      The listing goes live once its system files are uploaded.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Subcategory discovery */}
        <section className="border-b border-white/10 bg-[#080A11]">
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
                  search={
                    { category: BUSINESS_SYSTEMS_LABEL, sub: c.name } as never
                  }
                  className="group flex min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-gold/55 hover:bg-white/[0.06] focus-visible:border-gold focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-gold/25 bg-gold/10"
                  >
                    <CategoryLineIcon
                      slug={BUSINESS_SYSTEMS_SLUG}
                      className="h-6 w-6"
                    />
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

        {/* Live systems with filters */}
        <section className="border-b border-white/10 bg-[#0A0D17]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
              In this department
            </h2>
            <div
              role="tablist"
              aria-label="Filter business systems"
              className="mt-5 flex flex-wrap gap-2"
            >
              {FILTERS.map((f) => {
                const active = f === filter;
                return (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(f)}
                    className={`rounded-full border px-4 py-2 text-[12px] font-bold uppercase tracking-caps transition ${
                      active
                        ? "border-gold bg-gold text-navy"
                        : "border-white/20 text-white/75 hover:border-gold/60 hover:text-gold"
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>

            {visible.length > 0 ? (
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {visible.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            ) : (
              <p className="mt-7 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-[14px] text-white/65">
                No systems in this group yet. New Business Systems are added as
                they’re released — browse{" "}
                <Link
                  to="/products"
                  className="font-bold text-gold hover:underline"
                >
                  the full catalog
                </Link>{" "}
                in the meantime.
              </p>
            )}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gradient-to-r from-[#0B1020] via-[#141024] to-[#241E10]">
          <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 md:py-18 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
              More than templates. Complete systems you can put to work.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] text-white/75">
              Workflows, prompts, dashboards, and implementation plans —
              organized so you can run marketing, sales, service, and operations
              with less guesswork.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/products"
                search={{ category: BUSINESS_SYSTEMS_LABEL } as never}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-[13px] font-bold uppercase tracking-caps text-navy transition hover:brightness-105"
              >
                Explore Business Systems <ArrowRight size={15} aria-hidden />
              </Link>
              <Link
                to="/academy"
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-[13px] font-bold uppercase tracking-caps text-white transition hover:border-gold/70 hover:text-gold"
              >
                Visit the Academy
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketShell>
  );
}
