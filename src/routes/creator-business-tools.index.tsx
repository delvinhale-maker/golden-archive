import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Mail } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { CategoryLineIcon } from "@/components/marketplace/CategoryIcons";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { getProducts } from "@/lib/marketplace.functions";
import { logCtaClick } from "@/lib/cta-tracking";
import { subcategoriesQuery } from "@/lib/subcategories";
import {
  CREATOR_TOOLS_DESCRIPTION,
  CREATOR_TOOLS_FLAGSHIP,
  CREATOR_TOOLS_LABEL,
  CREATOR_TOOLS_SLUG,
  CREATOR_TOOLS_TAGLINE,
  CREATOR_TOOL_SUBS,
} from "@/lib/creator-business-tools";

const CANONICAL = "https://www.aurumvault.store/creator-business-tools";
const SEO_TITLE =
  "Creator Business Tools for Influencers & Content Creators | AurumVault";
const SEO_DESC =
  "Shop professional creator business tools for media kits, brand partnerships, rate cards, campaign management, creator analytics, outreach, payments, and growth.";

export const Route = createFileRoute("/creator-business-tools/")({
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
          name: `AurumVault ${CREATOR_TOOLS_LABEL}`,
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
              name: CREATOR_TOOLS_LABEL,
              item: CANONICAL,
            },
          ],
        }),
      },
    ],
  }),
  component: CreatorBusinessToolsPage,
});

function GoldRule({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block h-px w-24 bg-gradient-to-r from-transparent via-gold/70 to-transparent ${className}`}
    />
  );
}

const FILTERS = ["All", ...CREATOR_TOOL_SUBS.map((s) => s.filter)] as const;

function CreatorBusinessToolsPage() {
  const [filter, setFilter] = useState<string>("All");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const navigate = useNavigate();

  function startSignup(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(null);
    logCtaClick("creator_business_tools_email_capture");
    try {
      window.sessionStorage.setItem("av_prefill_email", clean);
      window.sessionStorage.setItem(
        "av_prefill_cta_source",
        "creator_business_tools_email_capture",
      );
    } catch {
      /* ignore */
    }
    void navigate({ to: "/sell-with-us" });
  }

  const { data: managed } = useQuery(subcategoriesQuery);
  const liveSubs = new Set(
    (managed ?? [])
      .filter((s) => s.category_slug === CREATOR_TOOLS_SLUG)
      .map((s) => s.name),
  );
  const cards = CREATOR_TOOL_SUBS.filter(
    (c) => liveSubs.size === 0 || liveSubs.has(c.name),
  );

  const { data: listing } = useQuery({
    queryKey: ["creator-business-tools-products"],
    queryFn: () =>
      getProducts({
        data: { category: CREATOR_TOOLS_SLUG, pageSize: 24, page: 1 },
      }),
    staleTime: 60_000,
  });
  const products = listing?.items ?? [];

  const flagship = products.find((p) =>
    (p.title ?? "").toLowerCase().includes(CREATOR_TOOLS_FLAGSHIP.titleMatch),
  );

  const visible = useMemo(() => {
    const sub = CREATOR_TOOL_SUBS.find((s) => s.filter === filter);
    const ordered = flagship
      ? [flagship, ...products.filter((p) => p.id !== flagship.id)]
      : products;
    if (!sub) return ordered;
    return ordered.filter((p) => (p.subcategory ?? "") === sub.name);
  }, [products, filter, flagship]);

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
              <BadgeCheck size={12} aria-hidden /> AurumVault{" "}
              {CREATOR_TOOLS_LABEL}
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold leading-[1.1] text-white sm:text-4xl md:text-5xl">
              Creator <span className="text-gold">Business Tools</span>
            </h1>
            <GoldRule className="mt-5" />
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/80 md:text-base">
              Professional systems for creators who are ready to turn content
              into business.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
              From media kits and brand pitches to campaign management, pricing,
              analytics, and payments, these tools help creators operate with
              more structure and professionalism.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="#creator-tools"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-[13px] font-bold uppercase tracking-caps text-navy transition hover:brightness-105"
              >
                Explore Creator Business Tools{" "}
                <ArrowRight size={15} aria-hidden />
              </a>
              <Link
                to="/products"
                search={{ category: CREATOR_TOOLS_LABEL } as never}
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-[13px] font-bold uppercase tracking-caps text-white transition hover:border-gold/70 hover:text-gold"
              >
                Browse All Tools
              </Link>
            </div>
          </div>
        </section>

        {/* Intro */}
        <section className="border-b border-white/10 bg-[#080A11]">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
              {CREATOR_TOOLS_TAGLINE}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/75">
              {CREATOR_TOOLS_DESCRIPTION}
            </p>
          </div>
        </section>

        {/* Featured product */}
        <section
          id="creator-tools"
          className="border-b border-white/10 bg-[#0A0D17]"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
            <h2 className="font-display text-[11px] font-bold uppercase tracking-caps text-gold">
              Featured Tool
            </h2>
            <div className="mt-5 grid gap-8 rounded-2xl border border-gold/25 bg-white/[0.03] p-5 md:grid-cols-[1.15fr_1fr] md:p-8">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  {CREATOR_TOOLS_FLAGSHIP.badges.map((b) => (
                    <span
                      key={b}
                      className="inline-block rounded-sm border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-gold"
                    >
                      {b}
                    </span>
                  ))}
                </div>
                <h3 className="mt-3 font-display text-2xl font-bold leading-tight text-white md:text-3xl">
                  {CREATOR_TOOLS_FLAGSHIP.title}
                </h3>
                <p className="mt-2 text-sm text-white/70">
                  {CREATOR_TOOLS_FLAGSHIP.subtitle}
                </p>
                <p className="mt-4 text-[14px] leading-relaxed text-white/65">
                  {CREATOR_TOOLS_FLAGSHIP.description}
                </p>
                <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                  {CREATOR_TOOLS_FLAGSHIP.highlights.map((h) => (
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
                    {CREATOR_TOOLS_LABEL}
                  </div>
                  <div className="mt-1 text-[12px] text-white/50">
                    {CREATOR_TOOLS_FLAGSHIP.subcategory} ·{" "}
                    {CREATOR_TOOLS_FLAGSHIP.productType}
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-gold">
                      $
                      {(
                        flagship?.price ?? CREATOR_TOOLS_FLAGSHIP.launchPrice
                      ).toFixed(2)}
                    </span>
                    {!flagship && (
                      <span className="text-sm text-white/45 line-through">
                        ${CREATOR_TOOLS_FLAGSHIP.regularPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                {flagship ? (
                  <Link
                    to="/products/$id"
                    params={{ id: flagship.id }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-[13px] font-bold uppercase tracking-caps text-navy transition hover:brightness-105"
                  >
                    View the Full System <ArrowRight size={15} aria-hidden />
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <span className="flex w-full items-center justify-center rounded-full border border-gold/40 bg-gold/10 px-5 py-3 text-[13px] font-bold uppercase tracking-caps text-gold">
                      Releasing Soon
                    </span>
                    <p className="text-center text-[12px] text-white/50">
                      The listing goes live once its interactive PDF is
                      uploaded.
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
                  to="/creator-business-tools/$sub"
                  params={{ sub: c.slug }}
                  onClick={() =>
                    logCtaClick(`creator_business_tools_grid:${c.slug}`)
                  }
                  className="group flex min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-gold/55 hover:bg-white/[0.06] focus-visible:border-gold focus-visible:outline-none"
                >

                  <span
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-gold/25 bg-gold/10"
                  >
                    <CategoryLineIcon
                      slug={CREATOR_TOOLS_SLUG}
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

        {/* Live products with filters */}
        <section className="border-b border-white/10 bg-[#0A0D17]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
              In this department
            </h2>
            <div
              role="tablist"
              aria-label="Filter creator business tools"
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
                No tools in this group yet. New Creator Business Tools are added
                as they’re released — browse{" "}
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

        {/* Email capture → creator signup flow */}
        <section className="border-b border-white/10 bg-[#080A11]">
          <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 md:py-16 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-caps text-gold">
              <Mail size={12} aria-hidden /> Creator access
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold text-white md:text-3xl">
              Get new Creator Business Tools first
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-white/70">
              Enter your email to start creator signup and get the free
              AurumVault Creator Starter Kit — plus early access to new tools.
            </p>
            <form
              onSubmit={startSignup}
              className="mx-auto mt-7 flex w-full max-w-md flex-col gap-3 sm:flex-row"
              noValidate
            >
              <label htmlFor="cbt-email" className="sr-only">
                Email address
              </label>
              <input
                id="cbt-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 rounded-full border border-white/20 bg-white/[0.06] px-5 py-3 text-[14px] text-white placeholder-white/40 outline-none transition focus:border-gold"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-[13px] font-bold uppercase tracking-caps text-navy transition hover:brightness-105"
              >
                Start Creator Signup <ArrowRight size={15} aria-hidden />
              </button>
            </form>
            {emailError && (
              <p role="alert" className="mt-3 text-[13px] text-red-300">
                {emailError}
              </p>
            )}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gradient-to-r from-[#0B1020] via-[#141024] to-[#241E10]">
          <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 md:py-18 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
              Operate like a business, not a hobby.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] text-white/75">
              Media kits, rate cards, pitch systems, campaign tracking, and
              partnership revenue tools — built for creators who take the work
              seriously.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/products"
                search={{ category: CREATOR_TOOLS_LABEL } as never}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-[13px] font-bold uppercase tracking-caps text-navy transition hover:brightness-105"
              >
                Explore Creator Business Tools{" "}
                <ArrowRight size={15} aria-hidden />
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
