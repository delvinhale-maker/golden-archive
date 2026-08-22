import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useSuspenseQuery, queryOptions, useQueryClient, useQueryErrorResetBoundary, useIsFetching } from "@tanstack/react-query";
import { Suspense, lazy, type ReactElement } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  CalendarDays,
  Crown,
  Download,
  GraduationCap,
  Headphones,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
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
import statProductsImg from "@/assets/stat-products.jpg";
import statCategoriesImg from "@/assets/stat-categories.jpg";
import statCreatorsImg from "@/assets/stat-creators.jpg";
import statDownloadsImg from "@/assets/stat-downloads.jpg";

import { kingdomPicksRowQ } from "@/components/marketplace/KingdomPicksRow";
import { newReleasesRowQ } from "@/components/marketplace/NewReleasesRow";
import { ContinueBrowsingRow } from "@/components/marketplace/HomeRows";
import { topCreatorsQ } from "@/components/marketplace/TopCreatorsLeaderboard";
import { categoryCountsQ } from "@/components/marketplace/CategoryGrid13";
import { SectionDivider } from "@/components/marketplace/SectionDivider";
import {
  getFeaturedProducts,
  getHomeHighlights,
  type Product,
} from "@/lib/marketplace.functions";
import { getHomepageLayout } from "@/lib/homepage-layout.functions";
import { rotateHalfDay } from "@/lib/affiliate-rotation";
import { BROWSE_CATEGORIES } from "@/lib/categories";

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
const VaultFindsGrid = lazy(() =>
  import("@/components/marketplace/VaultFindsGrid").then((m) => ({ default: m.VaultFindsGrid })),
);
const VaultFindsCategorySections = lazy(() =>
  import("@/components/marketplace/VaultFindsCategorySections").then((m) => ({ default: m.VaultFindsCategorySections })),
);
const AcademyLatestRow = lazy(() =>
  import("@/components/marketplace/AcademyLatestRow").then((m) => ({ default: m.AcademyLatestRow })),
);
import { academyLatestQ } from "@/components/marketplace/AcademyLatestRow";

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
const homepageLayoutQ = queryOptions({
  queryKey: ["homepage-layout"],
  queryFn: () => getHomepageLayout(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(featuredQ);
    context.queryClient.ensureQueryData(newReleasesRowQ);
    context.queryClient.ensureQueryData(kingdomPicksRowQ);
    context.queryClient.ensureQueryData(highlightsQ);
    context.queryClient.ensureQueryData(topCreatorsQ);
    context.queryClient.ensureQueryData(categoryCountsQ);
    context.queryClient.ensureQueryData(homepageLayoutQ);
    context.queryClient.ensureQueryData(academyLatestQ);
  },



  head: () => ({
    meta: [
      { title: "AurumVault — Sell Digital Products, eBooks, AI Prompt Packs, Journals & Financial Planners" },
      {
        name: "description",
        content:
          "AurumVault is a premium digital marketplace where creators sell ebooks, AI prompt packs, journals, planners, templates, and digital business resources with instant delivery.",
      },
      { property: "og:title", content: "AurumVault — Sell Digital Products, eBooks, AI Prompt Packs, Journals & Financial Planners" },
      {
        property: "og:description",
        content:
          "AurumVault is a premium digital marketplace where creators sell ebooks, AI prompt packs, journals, planners, templates, and digital business resources with instant delivery.",
      },
      { property: "og:url", content: "https://www.aurumvault.store/" },
      { name: "twitter:title", content: "AurumVault — Sell Digital Products, eBooks, AI Prompt Packs, Journals & Financial Planners" },
      {
        name: "twitter:description",
        content:
          "AurumVault is a premium digital marketplace where creators sell ebooks, AI prompt packs, journals, planners, templates, and digital business resources with instant delivery.",
      },
    ],
  links: [{ rel: "canonical", href: "https://www.aurumvault.store/" }],
  }),

  component: Home,
});

// Homepage category tiles — labels come from the canonical nav list so they
// never drift from the header / search chips.
const CAT_ICONS: Record<string, typeof BookOpen> = {
  "AI Prompt Packs": Sparkles,
  eBooks: BookOpen,
  Journals: GraduationCap,
  "Financial Planners": Wallet,
};
const CATS = BROWSE_CATEGORIES.map((label) => ({
  label,
  icon: CAT_ICONS[label] ?? BookOpen,
  slug: label,
}));

const SECTION_REGISTRY: Record<string, () => React.ReactElement> = {
  new_releases: () => (
    <Suspense fallback={null}>
      <NewReleasesRow />
    </Suspense>
  ),
  kingdom_picks: () => (
    <Suspense fallback={null}>
      <KingdomPicksRow />
    </Suspense>
  ),
  featured_products: () => (
    <Suspense fallback={<FeaturedSkeleton />}>
      <FeaturedProducts />
    </Suspense>
  ),
  academy_latest: () => (
    <Suspense fallback={null}>
      <AcademyLatestRow />
    </Suspense>
  ),
  curated_bundles: () => (
    <Suspense fallback={null}>
      <CuratedBundlesRow />
    </Suspense>
  ),
};

const CuratedBundlesRow = lazy(() =>
  import("@/components/marketplace/CuratedBundlesRow").then((m) => ({
    default: m.CuratedBundlesRow,
  })),
);

const BusinessSystemsRow = lazy(() =>
  import("@/components/marketplace/BusinessSystemsRow").then((m) => ({
    default: m.BusinessSystemsRow,
  })),
);

const CreatorBusinessToolsRow = lazy(() =>
  import("@/components/marketplace/CreatorBusinessToolsRow").then((m) => ({
    default: m.CreatorBusinessToolsRow,
  })),
);

const AFFILIATE_REGISTRY: Record<string, () => React.ReactElement> = {
  vault_finds_row: () => (
    <Suspense fallback={null}>
      <VaultFindsRow />
    </Suspense>
  ),
  vault_finds_grid: () => (
    <Suspense fallback={null}>
      <VaultFindsGrid />
    </Suspense>
  ),
  vault_finds_category_sections: () => (
    <Suspense fallback={null}>
      <VaultFindsCategorySections />
    </Suspense>
  ),
};

const DEFAULT_SECTION_ORDER = [
  "new_releases",
  "kingdom_picks",
  "academy_latest",
  "category_grid",
  "featured_products",
  "curated_bundles",
];
const DEFAULT_AFFILIATE_ORDER = [
  "vault_finds_row",
  "vault_finds_grid",
  "vault_finds_category_sections",
];

function Home() {
  const { data: layout } = useSuspenseQuery(homepageLayoutQ);
  const sectionKeys = layout.sections.length
    ? layout.sections.map((s) => s.key)
    : DEFAULT_SECTION_ORDER;
  const affiliateKeys = layout.affiliates.length
    ? layout.affiliates.map((s) => s.key)
    : DEFAULT_AFFILIATE_ORDER;

  // Split configurable sections: the affiliate band lives right after
  // FeaturedProducts historically, but we keep the "IllustriousCreator"
  // section (and anything else configured after featured_products) below
  // the affiliate band to preserve the visual chrome.
  const featuredIdx = sectionKeys.indexOf("featured_products");
  const beforeAffiliate =
    featuredIdx >= 0 ? sectionKeys.slice(0, featuredIdx + 1) : sectionKeys;
  const afterAffiliate =
    featuredIdx >= 0 ? sectionKeys.slice(featuredIdx + 1) : [];

  return (
    <MarketShell>
      <HighlightsBoundary fallback={<HeroCarousel loading />} errorLabel="hero product">
        <FeaturedHero />
      </HighlightsBoundary>
      <Suspense fallback={null}>
        <FeaturedCollections />
      </Suspense>
      <TrustBar />
      <RefreshHighlightsBar />
      <ContinueBrowsingRow />

      {beforeAffiliate.map((key) => {
        const R = SECTION_REGISTRY[key];
        return R ? <div key={key}>{R()}</div> : null;
      })}

      <Suspense fallback={null}>
        <BusinessSystemsRow />
      </Suspense>

      <Suspense fallback={null}>
        <CreatorBusinessToolsRow />
      </Suspense>

      {/* --- Affiliate band (Vault Finds) --------------------------------- */}
      <AffiliateBandHeader />
      {affiliateKeys.map((key) => {
        const R = AFFILIATE_REGISTRY[key];
        return R ? <div key={key}>{R()}</div> : null;
      })}
      {/* --- End affiliate band ------------------------------------------ */}

      {afterAffiliate.map((key) => {
        const R = SECTION_REGISTRY[key];
        return R ? <div key={key}>{R()}</div> : null;
      })}

      <SectionDivider variant="ivory-to-navy" />
      <HeroStatsBar />
      <Suspense fallback={null}>
        <TopCreatorsLeaderboard />
      </Suspense>
      <SectionDivider variant="navy-to-ivory" />
      <Suspense fallback={null}>
        <WhyAurumVault />
      </Suspense>
      <Suspense fallback={null}>
        <KingdomBibleAppBanner />
      </Suspense>
      <Suspense fallback={null}>
        <EmailCaptureBanner />
      </Suspense>
    </MarketShell>
  );
}


function AffiliateBandHeader() {
  return (
    <section
      aria-label="Affiliate picks divider"
      className="border-y border-white/10 bg-[#1C1A20]"
    >
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="text-[11px] font-semibold tracking-[0.22em] text-gold">
            AFFILIATE PICKS · AMAZON
          </div>
          <h2 className="mt-2 font-display text-2xl text-white md:text-3xl">
            Vault Finds
          </h2>
          <p className="mt-2 max-w-xl text-xs text-white/60">
            Handpicked tools from around the web. Separate from AurumVault
            creator products — we may earn a commission on qualifying purchases.
          </p>
        </div>
      </div>
    </section>
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

function toHeroProduct(p: Product) {
  return {
    id: p.id,
    title: p.title,
    category: p.category,
    price: p.price,
    coverUrl: p.image && p.image.startsWith("http") ? p.image : null,
    compareAtPrice: p.compareAtPrice ?? null,
  };
}

function FeaturedHero() {
  const { data, isFetching } = useSuspenseQuery(highlightsQ);
  const { data: featured } = useSuspenseQuery(featuredQ);
  const { data: newest } = useSuspenseQuery(newReleasesRowQ);

  // Fresh rotation: the hero shows the latest releases, rotated every 12h so
  // the trio changes without losing the "newest first" feel.
  const newestPool = (newest ?? []) as Product[];
  const rotatedNew = rotateHalfDay(newestPool, 0, Math.min(3, newestPool.length));
  const hp = rotatedNew[0] ?? data.heroProduct;

  const heroTrio = (rotatedNew.length ? rotatedNew : (featured ?? []).slice(0, 3)).map(
    toHeroProduct,
  );
  const dealsProducts = heroTrio;
  const creatorProducts = heroTrio;


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
        heroProduct={hp ? toHeroProduct(hp) : null}
        dealsProducts={dealsProducts.length ? dealsProducts : creatorProducts}
        creatorProducts={creatorProducts}
      />
      <CategoryCTABar />
    </div>
  );
}

const CATEGORY_CTAS = [
  { label: "eBooks", slug: "ebooks", icon: BookOpen },
  { label: "AI Prompt Packs", slug: "ai_prompt_packs", icon: Sparkles },
  { label: "Financial Planners", slug: "financial_planners", icon: CalendarDays },
];

function CategoryCTABar() {
  return (
    <section className="relative border-t border-white/10 bg-navy">
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
          {CATEGORY_CTAS.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.slug}
                to="/products"
                search={{ category: cat.label }}
                aria-label={`Browse ${cat.label}`}
              >
                <motion.span
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-gold/60 hover:bg-white/10 hover:text-gold"
                >
                  <Icon size={16} className="text-gold" />
                  {cat.label}
                </motion.span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HeroStatsBar() {
  const { data } = useSuspenseQuery(highlightsQ);
  // Numeric counters intentionally hidden — keep only the labels + captions.
  void data;
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
      label: "Curated Library",
      caption: "Handpicked digital goods",
      to: "/products",
      ariaLabel: "Browse all products",
    },
    {
      image: statCategoriesImg,
      label: "Every Discipline",
      caption: "Wealth, wisdom, and craft",
      to: "/",
      hash: "categories",
      ariaLabel: "Browse categories",
    },
    {
      image: statCreatorsImg,
      label: "Independent Creators",
      caption: "Curated, trusted, human",
      to: "/about",
      ariaLabel: "Learn about our creators",
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
            Sell Digital Products, eBooks, AI Prompt Packs,{" "}
            <span className="gold-gradient">Journals &amp; Financial Planners</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg"
          >
            AurumVault is a premium digital marketplace where creators sell ebooks,
            AI prompt packs, journals, planners, templates, and digital business
            resources with instant delivery.
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
    <section className="pb-16 pt-4 md:pb-24" style={{ backgroundColor: "#1C1A20" }}>
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
    <section className="pb-16 pt-4" style={{ backgroundColor: "#1C1A20" }}>
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

function TrustBar() {
  const items = [
    { icon: Lock, label: "Secure Checkout" },
    { icon: Download, label: "Instant Download" },
    { icon: BadgeCheck, label: "Curated Creators" },
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

