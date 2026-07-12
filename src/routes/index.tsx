import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useSuspenseQuery, queryOptions, useQueryClient, useQueryErrorResetBoundary, useIsFetching } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
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
  Twitter,
  Wallet,
} from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/marketplace/ProductCard";
import { ProductCover } from "@/components/marketplace/ProductCover";
import { HeroCarousel } from "@/components/marketplace/HeroCarousel";
import statProductsImg from "@/assets/stat-products.jpg";
import statCategoriesImg from "@/assets/stat-categories.jpg";
import statCreatorsImg from "@/assets/stat-creators.jpg";
import statDownloadsImg from "@/assets/stat-downloads.jpg";

import { kingdomPicksRowQ } from "@/components/marketplace/KingdomPicksRow";
import { newReleasesRowQ } from "@/components/marketplace/NewReleasesRow";
import { ContinueBrowsingRow } from "@/components/marketplace/HomeRows";
import { creatorSpotlightQ } from "@/components/marketplace/CreatorSpotlight";
import { featuredCreatorsQ } from "@/components/marketplace/FeaturedCreatorsRow";
import { topCreatorsQ } from "@/components/marketplace/TopCreatorsLeaderboard";
import { categoryCountsQ } from "@/components/marketplace/CategoryGrid13";
import { SectionDivider } from "@/components/marketplace/SectionDivider";
import { CountUp } from "@/components/marketplace/CountUp";
import {
  getFeaturedProducts,
  getHomeHighlights,
  type Product,
} from "@/lib/marketplace.functions";

import { useAuth } from "@/hooks/use-auth";

// Below-the-fold sections — lazy-loaded to shrink initial JS and cut hydration cost.
const FeaturedCollections = lazy(() =>
  import("@/components/marketplace/FeaturedCollections").then((m) => ({ default: m.FeaturedCollections })),
);
const KingdomPicksRow = lazy(() =>
  import("@/components/marketplace/KingdomPicksRow").then((m) => ({ default: m.KingdomPicksRow })),
);
const NewReleasesRow = lazy(() =>
  import("@/components/marketplace/NewReleasesRow").then((m) => ({ default: m.NewReleasesRow })),
);
const KingdomBibleAppBanner = lazy(() =>
  import("@/components/marketplace/KingdomBibleAppBanner").then((m) => ({ default: m.KingdomBibleAppBanner })),
);
const EmailCaptureBanner = lazy(() =>
  import("@/components/EmailCaptureBanner").then((m) => ({ default: m.EmailCaptureBanner })),
);
const CreatorSpotlight = lazy(() =>
  import("@/components/marketplace/CreatorSpotlight").then((m) => ({ default: m.CreatorSpotlight })),
);
const FeaturedCreatorsRow = lazy(() =>
  import("@/components/marketplace/FeaturedCreatorsRow").then((m) => ({ default: m.FeaturedCreatorsRow })),
);
const TopCreatorsLeaderboard = lazy(() =>
  import("@/components/marketplace/TopCreatorsLeaderboard").then((m) => ({ default: m.TopCreatorsLeaderboard })),
);
const CategoryGrid13 = lazy(() =>
  import("@/components/marketplace/CategoryGrid13").then((m) => ({ default: m.CategoryGrid13 })),
);
const WhyAurumVault = lazy(() =>
  import("@/components/marketplace/WhyAurumVault").then((m) => ({ default: m.WhyAurumVault })),
);
const VaultFindsRow = lazy(() =>
  import("@/components/marketplace/VaultFindsRow").then((m) => ({ default: m.VaultFindsRow })),
);

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
    context.queryClient.ensureQueryData(newReleasesRowQ);
    context.queryClient.ensureQueryData(kingdomPicksRowQ);
    context.queryClient.ensureQueryData(highlightsQ);
    context.queryClient.ensureQueryData(creatorSpotlightQ);
    context.queryClient.ensureQueryData(featuredCreatorsQ);
    context.queryClient.ensureQueryData(topCreatorsQ);
    context.queryClient.ensureQueryData(categoryCountsQ);
  },



  head: () => ({
    meta: [
      { title: "AurumVault — Premium Digital Resources. Delivered Instantly." },
      {
        name: "description",
        content:
          "Premium digital resources for builders, leaders, and visionaries. Curated eBooks, courses, templates, and tools — verified and instant.",
      },
      { property: "og:title", content: "AurumVault — Premium Digital Resources. Delivered Instantly." },
      {
        property: "og:description",
        content:
          "Premium digital marketplace for eBooks, courses, templates, and audio. Curated. Verified. Instant.",
      },
      { property: "og:url", content: "https://www.aurumvault.store/" },
      { name: "twitter:title", content: "AurumVault — Premium Digital Resources. Delivered Instantly." },
      {
        name: "twitter:description",
        content:
          "Premium digital marketplace for eBooks, courses, templates, and audio. Curated. Verified. Instant.",
      },
    ],
  links: [{ rel: "canonical", href: "https://www.aurumvault.store/" }],
  }),

  component: Home,
});

const CATS = [
  { label: "eBooks", icon: BookOpen, slug: "eBooks" },
  { label: "Journals", icon: GraduationCap, slug: "Journals" },
  { label: "Templates", icon: LayoutTemplate, slug: "Templates" },
  { label: "Audio", icon: Headphones, slug: "Audio" },
  { label: "Financial Planners", icon: Wallet, slug: "Financial Planners" },
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
      <Suspense fallback={null}>
        <FeaturedCollections />
      </Suspense>
      <TrustBar />
      <RefreshHighlightsBar />
      <ContinueBrowsingRow />

      <Suspense fallback={null}>
        <NewReleasesRow />
      </Suspense>
      <Suspense fallback={null}>
        <KingdomPicksRow />
      </Suspense>

      <Suspense fallback={null}>
        <FeaturedCreatorsRow />
      </Suspense>

      <Suspense fallback={null}>
        <CategoryGrid13 />
      </Suspense>

      <Suspense fallback={<FeaturedSkeleton />}>
        <FeaturedProducts />
      </Suspense>
      <HighlightsBoundary fallback={<CreatorSkeleton />} errorLabel="featured creator">
        <IllustriousCreator />
      </HighlightsBoundary>
      <Suspense fallback={null}>
        <CreatorSpotlight />
      </Suspense>
      <SectionDivider variant="ivory-to-navy" />
      <HeroStatsBar />
      <Suspense fallback={null}>
        <TopCreatorsLeaderboard />
      </Suspense>
      <SectionDivider variant="navy-to-ivory" />
      <Suspense fallback={null}>
        <WhyAurumVault />
      </Suspense>
      <SocialsSection />
      <Suspense fallback={null}>
        <KingdomBibleAppBanner />
      </Suspense>
      <Suspense fallback={null}>
        <EmailCaptureBanner />
      </Suspense>

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
          aria-label="Refresh hero product and AurumVault Originals count"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[11px] font-semibold tracking-caps text-navy transition hover:border-gold hover:text-gold-ink disabled:opacity-60"
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
              <div className="text-[11px] font-semibold tracking-caps text-gold-ink">
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




function HeroStatsBar() {
  const { data } = useSuspenseQuery(highlightsQ);
  const productCount = data.illustriousProductCount;
  const stats: {
    image: string;
    label: React.ReactNode;
    caption: string;
    to: string;
    hash?: string;
    ariaLabel: string;
  }[] = [
    {
      image: statProductsImg,
      label: (
        <>
          <CountUp end={productCount} /> Product{productCount === 1 ? "" : "s"}
        </>
      ),
      caption: "Curated library",
      to: "/products",
      ariaLabel: "Browse all products",
    },
    {
      image: statCategoriesImg,
      label: (
        <>
          <CountUp end={18} /> Categories
        </>
      ),
      caption: "Across every discipline",
      to: "/",
      hash: "categories",
      ariaLabel: "Browse categories",
    },
    {
      image: statCreatorsImg,
      label: "Verified Creators",
      caption: "Vetted, trusted, human",
      to: "/about",
      ariaLabel: "Learn about our verified creators",
    },
    {
      image: statDownloadsImg,
      label: "Instant Download",
      caption: "In your vault, seconds later",
      to: "/library",
      ariaLabel: "Go to your library of instant downloads",
    },
  ];
  return (
    <section className="relative bg-[#08101D] py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="text-[11px] font-semibold tracking-[0.22em] text-gold">
            THE AURUMVAULT STANDARD
          </div>
          <h2 className="mt-3 font-display text-3xl leading-tight text-white md:text-4xl">
            Built on trust. <span className="gold-gradient">Delivered instantly.</span>
          </h2>
          <span className="mt-5 block h-[2px] w-10 bg-gold" />
        </div>
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {stats.map((s) => (
            <li key={s.caption}>
              <Link
                to={s.to}
                hash={s.hash}
                aria-label={s.ariaLabel}
                className="group block overflow-hidden rounded-2xl bg-navy ring-1 ring-white/10 shadow-[0_16px_44px_-20px_rgba(0,0,0,0.6)] transition-transform duration-500 hover:-translate-y-1 hover:ring-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <img
                    src={s.image}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.08]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08101D] via-[#08101D]/30 to-transparent" />
                </div>
                <div className="px-4 py-4 md:px-5 md:py-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
                    {s.caption}
                  </div>
                  <div className="mt-1.5 font-display text-lg text-white md:text-xl">
                    {s.label}
                  </div>
                </div>
              </Link>
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
            className="text-[11px] font-semibold tracking-caps text-gold-ink"
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
                className="av-glow-pulse inline-flex h-12 items-center rounded-full bg-gold px-7 text-sm font-bold text-navy shadow-gold-glow transition-all duration-300 hover:bg-gold-soft hover:brightness-110 hover:saturate-110"
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
            <div className="text-[10px] font-semibold tracking-caps text-gold-ink">
              {c.cat.toUpperCase()}
            </div>
            <div className="mt-1 font-display text-base font-bold text-ink">
              {c.title}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-display text-lg font-bold text-gold-ink">
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
        <div className="text-[11px] font-semibold tracking-caps text-gold-ink">
          {kicker}
        </div>
      )}
      <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl" style={{ color: "#ffffff" }}>
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
                className="group flex h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-line bg-white transition-all duration-200 ease-out hover:-translate-y-1 hover:border-gold hover:shadow-card-hover"
              >
                <c.icon className="text-gold-ink transition-transform duration-200 group-hover:scale-110" size={32} strokeWidth={1.6} />
                <span className="text-sm font-bold text-navy">{c.label}</span>

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
            className="inline-flex h-11 items-center rounded-full border border-gold px-6 text-sm font-bold text-gold-ink hover:bg-gold hover:text-navy"
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
        <SectionHeader kicker="FEATURED CREATOR" title="Featured Creator" />
        <span className="sr-only" aria-live="polite">
          {isFetching ? "Refreshing featured creator" : ""}
        </span>
        <div className="mx-auto max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            whileHover={{ y: -4 }}
            className="overflow-hidden rounded-lg border border-line bg-white shadow-card"
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
                className="-mt-8 grid h-16 w-16 place-items-center overflow-hidden rounded-full border-[3px] border-white bg-navy"
                aria-hidden
              >
                <img
                  src="/og-image.png"
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <div className="font-display text-lg font-bold text-navy">
                  Delvin Hale
                </div>
                <BadgeCheck size={16} className="text-emerald" />
              </div>
              <div className="text-[13px] text-mute">
                Author · Entrepreneur · Digital Creator
              </div>
              <div className="mt-4 flex items-center gap-6 text-[13px]">
                <div>
                  <div className="font-bold text-navy">{count}</div>
                  <div className="text-[11px] text-mute">Products</div>

                </div>
              </div>
              <Link
                to="/products"
                className="mt-4 inline-flex items-center text-sm font-bold text-gold-ink hover:underline"
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
    { icon: Download, label: "Instant Download" },
    { icon: BadgeCheck, label: "Verified Creators" },
    { icon: ShieldCheck, label: "Curated Quality" },
    { icon: Star, label: "5-Star Rated" },
  ];
  return (
    <section className="border-y border-line bg-bg-page">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-around gap-4 px-6 py-6 lg:px-8">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <it.icon size={16} className="text-gold-ink" />
            <span className="text-[13px] font-medium text-navy">{it.label}</span>
            {i < items.length - 1 && (
              <span className="ml-4 hidden h-1 w-1 rounded-full bg-navy/40 md:block" />
            )}
          </div>
        ))}
      </div>
    </section>


  );
}

function SocialsSection() {
  const links = [
    {
      label: "X",
      href: "https://x.com/AurumVault",
      icon: Twitter,
    },
    {
      label: "Twitter",
      href: "https://twitter.com/AurumVault",
      icon: Twitter,
    },
  ];

  return (
    <section className="border-y border-line bg-bg-page">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="mb-8 text-center">
          <div className="text-[11px] font-semibold tracking-caps text-gold-ink">
            STAY CONNECTED
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-navy md:text-3xl">
            Follow AurumVault
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:-translate-y-0.5 hover:border-gold hover:shadow-card-hover"
            >
              <link.icon size={16} className="text-gold-ink" />
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </section>

  );
}
