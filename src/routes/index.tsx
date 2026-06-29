import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useSuspenseQuery, queryOptions, useQueryClient, useQueryErrorResetBoundary, useIsFetching } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  Crown,
  Download,
  GraduationCap,
  Headphones,
  LayoutTemplate,
  Lock,
  RefreshCw,
  ShieldCheck,
  Star,
  Swords,
  Wallet,
} from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/marketplace/ProductCard";
import { ProductCover } from "@/components/marketplace/ProductCover";
import { HeroCarousel } from "@/components/marketplace/HeroCarousel";
import { DealsStrip } from "@/components/marketplace/DealsStrip";
import { BestsellersRow } from "@/components/marketplace/BestsellersRow";
import { KingdomPicksRow } from "@/components/marketplace/KingdomPicksRow";
import { KingdomBibleAppBanner } from "@/components/marketplace/KingdomBibleAppBanner";
import { ContinueBrowsingRow, HomeContentRows } from "@/components/marketplace/HomeRows";
import { EmailCaptureBanner } from "@/components/EmailCaptureBanner";
import {
  getFeaturedProducts,
  getHomeHighlights,
  type Product,
} from "@/lib/marketplace.functions";
import { useAuth } from "@/hooks/use-auth";

const featuredQ = queryOptions({
  queryKey: ["mp", "featured"],
  queryFn: () => getFeaturedProducts(),
});
const highlightsQ = queryOptions({
  queryKey: ["mp", "home-highlights"],
  queryFn: () => getHomeHighlights(),
  staleTime: 0,
  refetchOnMount: "always",
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(featuredQ);
    context.queryClient.invalidateQueries({ queryKey: ["mp", "home-highlights"] });
    context.queryClient.ensureQueryData(highlightsQ);
  },
  head: () => ({
    meta: [
      { title: "AurumVault — Gold Standard Digital Commerce" },
      {
        name: "description",
        content:
          "Discover premium eBooks, courses, templates, and digital resources from verified purpose-driven creators. Powered by Illustrious Capital™.",
      },
      { property: "og:title", content: "AurumVault — Gold Standard Digital Commerce" },
      {
        property: "og:description",
        content:
          "Premium digital marketplace for eBooks, courses, templates, audio, and leadership resources.",
      },
      { property: "og:url", content: "https://www.aurumvault.store/" },
      { name: "twitter:title", content: "AurumVault — Gold Standard Digital Commerce" },
      {
        name: "twitter:description",
        content:
          "Premium digital marketplace for eBooks, courses, templates, audio, and leadership resources.",
      },
    ],
    links: [{ rel: "canonical", href: "https://www.aurumvault.store/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "AurumVault",
          alternateName: "Illustrious Capital™",
          url: "https://www.aurumvault.store",
          logo: "https://www.aurumvault.store/logo.png",
          description:
            "AurumVault is the gold-standard marketplace for purpose-driven digital products — curated from verified creators and powered by Illustrious Capital™.",
          sameAs: [],
        }),
      },
    ],
  }),
  component: Home,
});

const CATS = [
  { label: "eBooks", icon: BookOpen, slug: "eBooks" },
  { label: "Courses", icon: GraduationCap, slug: "Courses" },
  { label: "Templates", icon: LayoutTemplate, slug: "Templates" },
  { label: "Audio", icon: Headphones, slug: "Audio" },
  { label: "Finance", icon: Wallet, slug: "Finance" },
  { label: "Leadership", icon: Crown, slug: "Leadership" },
  { label: "Purpose", icon: Swords, slug: "Purpose" },
  { label: "Business", icon: Briefcase, slug: "Business" },
];

function Home() {
  return (
    <MarketShell>
      <HighlightsBoundary fallback={<HeroCarousel />} errorLabel="hero product">
        <FeaturedHero />
      </HighlightsBoundary>
      <HeroStatsBar />
      <TrustBar />
      <RefreshHighlightsBar />
      <Suspense fallback={null}>
        <DealsAndBestsellers />
      </Suspense>
      <KingdomBibleAppBanner />
      <ContinueBrowsingRow />
      <KingdomPicksRow />
      <CategoriesSection />

      <HomeContentRows />
      <Suspense fallback={<FeaturedSkeleton />}>
        <FeaturedProducts />
      </Suspense>
      <HighlightsBoundary fallback={<CreatorSkeleton />} errorLabel="featured creator">
        <IllustriousCreator />
      </HighlightsBoundary>
      <EmailCaptureBanner />
    </MarketShell>
  );
}

function RefreshHighlightsBar() {
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ queryKey: ["mp", "home-highlights"] }) > 0;
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;
  return (
    <div className="bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-end px-6 py-3 lg:px-8">
        <button
          type="button"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["mp", "home-highlights"] })
          }
          disabled={isFetching}
          aria-label="Refresh hero product and Illustrious Capital count"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[11px] font-semibold tracking-caps text-navy transition hover:border-gold hover:text-gold disabled:opacity-60"
        >
          <RefreshCw
            size={12}
            className={isFetching ? "animate-spin" : ""}
            aria-hidden
          />
          {isFetching ? "REFRESHING…" : "REFRESH NOW"}
        </button>
      </div>
    </div>
  );
}

function HighlightsBoundary({
  children,
  fallback,
  errorLabel,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
  errorLabel: string;
}) {
  const { reset } = useQueryErrorResetBoundary();
  const queryClient = useQueryClient();
  return (
    <ErrorBoundary
      onReset={reset}
      fallbackRender={({ resetErrorBoundary }) => (
        <section className="bg-white py-12">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <div className="rounded-xl border border-line bg-[#fff8f0] p-6">
              <div className="text-[11px] font-semibold tracking-caps text-gold">
                COULDN'T LOAD
              </div>
              <p className="mt-2 text-sm text-ink">
                We couldn't refresh the {errorLabel}. Check your connection and try again.
              </p>
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["mp", "home-highlights"] });
                  resetErrorBoundary();
                }}
                className="mt-4 inline-flex h-10 items-center rounded-full bg-navy px-5 text-sm font-bold text-white hover:bg-navy/90"
              >
                Retry
              </button>
            </div>
          </div>
        </section>
      )}
    >
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function CreatorSkeleton() {
  return (
    <section className="bg-[#f9fafb] py-16 md:py-24" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-md px-6">
        <div className="av-card overflow-hidden">
          <div className="h-[120px] animate-pulse bg-[#e5e7eb]" />
          <div className="px-6 pb-6">
            <div className="-mt-8 h-16 w-16 animate-pulse rounded-full border-[3px] border-white bg-[#e5e7eb]" />
            <div className="mt-3 h-5 w-48 animate-pulse rounded bg-[#e5e7eb]" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[#eef0f3]" />
            <div className="mt-4 h-6 w-16 animate-pulse rounded bg-[#eef0f3]" />
          </div>
        </div>
        <span className="sr-only">Loading featured creator…</span>
      </div>
    </section>
  );
}

function FeaturedHero() {
  const { data, isFetching } = useSuspenseQuery(highlightsQ);
  const hp = data.heroProduct;
  return (
    <div className="relative">
      {isFetching && (
        <div
          className="absolute left-0 right-0 top-0 z-20 h-0.5 overflow-hidden bg-white/10"
          aria-live="polite"
          aria-label="Refreshing hero"
        >
          <div className="h-full w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] bg-gold" />
        </div>
      )}
      <HeroCarousel
        heroProduct={
          hp
            ? {
                id: hp.id,
                title: hp.title,
                category: hp.category,
                price: hp.price,
                coverUrl:
                  hp.image && hp.image.startsWith("http") ? hp.image : null,
              }
            : null
        }
      />
    </div>
  );
}

function DealsAndBestsellers() {
  const { data } = useSuspenseQuery(featuredQ);
  const list = data as Product[];
  return (
    <>
      <DealsStrip products={list} />
      <BestsellersRow products={[...list].reverse()} />
    </>
  );
}

function HeroStatsBar() {
  const stats = [
    { icon: BookOpen, label: "32+ Products" },
    { icon: LayoutTemplate, label: "18 Categories" },
    { icon: BadgeCheck, label: "Verified Creators" },
    { icon: Download, label: "Instant Download" },
  ];
  return (
    <section
      className="border-t bg-bg-page"
      style={{
        borderTopColor: "rgba(201,168,76,0.55)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
        <ul className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:gap-y-0">
          {stats.map((s) => (
            <li
              key={s.label}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-full"
                style={{
                  background: "rgba(201,168,76,0.12)",
                  border: "1px solid rgba(201,168,76,0.45)",
                }}
              >
                <s.icon size={18} className="text-gold" />
              </span>
              <span className="text-[12px] font-semibold tracking-wide text-white sm:text-[13px]">
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="av-hero-bg relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[55%_45%] md:py-24 lg:px-8 lg:py-28">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-[11px] font-semibold tracking-caps text-gold"
          >
            AURUMVAULT — GOLD STANDARD COMMERCE
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 font-display text-4xl leading-[1.05] text-white sm:text-5xl md:text-6xl lg:text-[64px]"
          >
            Discover <span className="gold-gradient">premium</span> digital
            resources.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg"
          >
            Curated eBooks, courses, templates, and tools from verified
            purpose-driven creators.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/products"
              className="group"
            >
              <motion.span
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex h-12 items-center rounded-full bg-gold px-7 text-sm font-bold text-navy shadow-gold-glow"
              >
                Shop Now →
              </motion.span>
            </Link>
            <motion.a
              whileHover={{ scale: 1.02, backgroundColor: "#fff", color: "#0f1629" }}
              whileTap={{ scale: 0.97 }}
              href="#categories"
              className="inline-flex h-12 items-center rounded-full border border-white/70 px-7 text-sm font-bold text-white"
            >
              Start Selling →
            </motion.a>
          </motion.div>
        </div>

        <HeroStack />
      </div>
    </section>
  );
}

function HeroStack() {
  const cards = [
    { title: "The Stewardship Codex", cat: "eBook", price: 49 },
    { title: "Sovereign Leadership", cat: "Course", price: 199 },
    { title: "Boardroom Liturgy", cat: "Audio", price: 29 },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.3 }}
      className="relative mx-auto hidden h-[420px] w-full max-w-md md:block"
    >
      {cards.map((c, i) => (
        <motion.div
          key={i}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 + i * 0.12 }}
          style={{
            zIndex: 10 - i,
            transform: `translate(${i * 20}px, ${i * 18}px)`,
          }}
          className="absolute right-0 top-0 w-72 overflow-hidden rounded-xl bg-white shadow-card-hover"
        >
          <div className="h-44 bg-[#f5f4ef]">
            <ProductCover title={c.title} category={c.cat} className="h-full w-full object-cover" />
          </div>
          <div className="p-4">
            <div className="text-[10px] font-semibold tracking-caps text-gold">
              {c.cat.toUpperCase()}
            </div>
            <div className="mt-1 font-display text-base font-bold text-ink">
              {c.title}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-display text-lg font-bold text-gold">
                ${c.price}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-mute">
                <Star size={11} fill="var(--gold)" stroke="var(--gold)" /> 4.9
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

function SectionHeader({ kicker, title }: { kicker?: string; title: string }) {
  return (
    <div className="mb-10 flex flex-col items-center text-center">
      {kicker && (
        <div className="text-[11px] font-semibold tracking-caps text-gold">
          {kicker}
        </div>
      )}
      <h2 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">
        {title}
      </h2>
      <span className="mt-3 block h-[2px] w-10 bg-gold" />
    </div>
  );
}

function CategoriesSection() {
  return (
    <section id="categories" className="bg-bg-page py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader title="Browse Categories" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {CATS.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Link
                to="/products"
                search={{ category: c.slug } as never}
                className="group flex h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-gold hover:bg-white/10"
              >
                <c.icon className="text-gold transition-transform duration-200 group-hover:scale-110" size={32} strokeWidth={1.6} />
                <span className="text-sm font-bold text-white">{c.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}


function FeaturedProducts() {
  const { data } = useSuspenseQuery(featuredQ);
  return (
    <section className="bg-bg-page pb-16 pt-4 md:pb-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader title="Featured Products" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {(data as Product[]).slice(0, 8).map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            to="/products"
            className="inline-flex h-11 items-center rounded-full border border-gold px-6 text-sm font-bold text-gold hover:bg-gold hover:text-navy"
          >
            See all products →
          </Link>
        </div>
      </div>
    </section>
  );
}


function FeaturedSkeleton() {
  return (
    <section className="bg-bg-page pb-16 pt-4">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader title="Featured Products" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function IllustriousCreator() {
  const { data, isFetching } = useSuspenseQuery(highlightsQ);
  const count = data.illustriousProductCount;
  return (
    <section className="bg-bg-page py-16 md:py-24" aria-busy={isFetching}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader kicker="OUR FOUNDING PUBLISHER" title="Illustrious Capital™" />
        {isFetching && (
          <div className="mb-4 text-center text-[11px] font-semibold tracking-caps text-mute" aria-live="polite">
            Refreshing…
          </div>
        )}
        <div className="mx-auto max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            whileHover={{ y: -4 }}
            className="av-card overflow-hidden"
          >
            <div
              className="h-[120px]"
              style={{
                background:
                  "linear-gradient(135deg, #0f1629 0%, #1a2744 50%, #c9a227 130%)",
              }}
            />
            <div className="px-6 pb-6">
              <div
                className="-mt-8 grid h-16 w-16 place-items-center rounded-full border-[3px] border-white bg-navy text-gold font-display text-xl font-bold"
                aria-hidden
              >
                IC
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <div className="font-display text-lg font-bold text-ink">
                  Illustrious Capital™
                </div>
                <BadgeCheck size={16} className="text-emerald" />
              </div>
              <div className="text-[13px] text-mute">
                Kingdom-centered digital resources
              </div>
              <div className="mt-4 flex items-center gap-6 text-[13px]">
                <div>
                  <div className="font-bold text-ink">{count}</div>
                  <div className="text-[11px] text-mute">Products</div>
                </div>
              </div>
              <Link
                to="/products"
                className="mt-4 inline-flex items-center text-sm font-bold text-gold hover:underline"
              >
                View Store →
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  const items = [
    { icon: Lock, label: "Secure Checkout" },
    { icon: ShieldCheck, label: "Verified Creators" },
    { icon: Download, label: "Instant Download" },
    { icon: Star, label: "5-Star Support" },
  ];
  return (
    <section className="border-y border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-around gap-4 px-6 py-6 lg:px-8">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <it.icon size={16} className="text-gold" />
            <span className="text-[13px] font-medium text-ink">{it.label}</span>
            {i < items.length - 1 && (
              <span className="ml-4 hidden h-1 w-1 rounded-full bg-mute md:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
