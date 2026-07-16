import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { ProductCover } from "./ProductCover";
import { useTheme } from "@/lib/theme/ThemeProvider";

type SlideTheme = { accentColor: string; gradientStart: string };

export type HeroProduct = {
  id: string;
  title: string;
  category: string;
  price: number;
  coverUrl?: string | null;
  compareAtPrice?: number | null;
};

type SlideKind = "hero" | "deals" | "creator";

type Slide = {
  kind: SlideKind;
  kicker: string;
  title: React.ReactNode;
  body: string;
  ctaLabel: string;
  ctaTo: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  theme: SlideTheme;
};

const HERO_SLIDE: Slide = {
  kind: "hero",
  kicker: "",
  title: (
    <>
      Sell Digital Products, eBooks, AI Prompt Packs, <span className="gold-gradient">Journals &amp; Financial Planners</span>
    </>
  ),
  body: "Premium digital resources for builders, leaders, and visionaries. Curated. Verified. Instant.",
  ctaLabel: "Shop Now →",
  ctaTo: "/products",
  theme: { accentColor: "#B8860B", gradientStart: "#0F1E35" },
};

const DEALS_SLIDE: Slide = {
  kind: "deals",
  kicker: "LIMITED TIME",
  title: (
    <>
      Today's <span className="gold-gradient">Best Deals</span>.
    </>
  ),
  body: "Hand-picked titles at exclusive prices — for a limited time only.",
  ctaLabel: "Shop Deals →",
  ctaTo: "/products",
  theme: { accentColor: "#C9A84C", gradientStart: "#0F1629" },
};

const CREATOR_SLIDE: Slide = {
  kind: "creator",
  kicker: "SELL ON AURUMVAULT",
  title: (
    <>
      Turn your knowledge into <span className="gold-gradient">income</span>.
    </>
  ),
  body: "Join a verified network of creators shipping premium eBooks, courses, and templates — with instant delivery, built-in affiliates, and monthly payouts.",
  ctaLabel: "Become a Creator →",
  ctaTo: "/become-a-creator",
  secondaryLabel: "Meet the creators →",
  secondaryHref: "/creators",
  theme: { accentColor: "#C9A227", gradientStart: "#0F1629" },
};

const FALLBACK_HERO: HeroProduct = {
  id: "fallback-hero",
  title: "Kingdom Mind",
  category: "eBook",
  price: 14.99,
};
const FALLBACK_STACK: HeroProduct[] = [
  { id: "f1", title: "The Stewardship Codex", category: "eBook", price: 19 },
  { id: "f2", title: "Not For Sale", category: "eBook", price: 12.99 },
  { id: "f3", title: "Purpose Blueprint", category: "Course", price: 29 },
];

function Cover({
  p,
  className,
  imgClassName,
  fit = "cover",
}: {
  p: HeroProduct;
  className?: string;
  imgClassName?: string;
  fit?: "cover" | "contain";
}) {
  const fitClass = fit === "contain" ? "object-contain" : "object-cover";
  return (
    <div className={`overflow-hidden rounded-xl bg-[#f5f4ef] ${className ?? ""}`}>
      {p.coverUrl ? (
        <img
          src={p.coverUrl}
          alt={p.title}
          className={`h-full w-full ${fitClass} ${imgClassName ?? ""}`}
          loading="eager"
        />
      ) : (
        <ProductCover
          title={p.title}
          category={p.category}
          className={`h-full w-full ${fitClass} ${imgClassName ?? ""}`}
        />
      )}
    </div>
  );
}

/** Single angled hero card with gold glow. */
function HeroVisual({ p }: { p: HeroProduct }) {
  return (
    <div className="relative mx-auto h-[300px] w-[183px] sm:h-[360px] sm:w-[220px] md:h-[420px] md:w-[260px]">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-[28px] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201,168,76,0.55), rgba(201,168,76,0) 70%)",
        }}
      />
      <motion.div
        initial={{ rotate: 0, y: 0 }}
        animate={{ rotate: 4, y: [0, -6, 0] }}
        transition={{
          rotate: { duration: 0.6 },
          y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
        }}
        className="relative h-full w-full overflow-hidden rounded-xl bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6),0_0_0_1px_rgba(201,168,76,0.35)]"
      >
        <div className="h-[62%] bg-white">
          <Cover p={p} fit="contain" className="h-full w-full rounded-none bg-transparent" />
        </div>
        <div className="flex h-[38%] flex-col justify-center p-3">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-gold-ink">
            {p.category.toUpperCase()}
          </div>
          <div className="mt-1 line-clamp-2 font-display text-base font-bold text-ink">
            {p.title}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-display text-lg font-bold" style={{ color: "#B8860B" }}>
              ${p.price.toFixed(2)}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-mute">
              <Star size={11} fill="#B8860B" stroke="#B8860B" /> 4.9
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/** Fanned arrangement of 2–3 covers for the deals slide. */
function DealsVisual({ items }: { items: HeroProduct[] }) {
  const list = items.slice(0, 3);
  while (list.length < 3) list.push(FALLBACK_STACK[list.length]);
  const rots = [-10, 0, 10];
  const offsets = [-52, 0, 52];
  const z = [1, 3, 2];

  const discountPct = (p: HeroProduct) => {
    if (!p.compareAtPrice || p.compareAtPrice <= p.price) return 0;
    return Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100);
  };

  return (
    <div className="relative mx-auto h-[300px] w-[300px] sm:h-[360px] sm:w-[380px] md:h-[420px] md:w-[440px]">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-[28px] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201,168,76,0.5), rgba(201,168,76,0) 70%)",
        }}
      />
      {list.map((p, i) => {
        const pct = discountPct(p);
        const hasDiscount = pct > 0;
        return (
          <motion.div
            key={p.id + i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, rotate: rots[i], x: offsets[i] }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="absolute left-1/2 top-1/2 h-[260px] w-[150px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-[0_20px_50px_-15px_rgba(0,0,0,0.55),0_0_0_1px_rgba(201,168,76,0.3)] sm:h-[290px] sm:w-[180px] md:h-[340px] md:w-[220px]"
            style={{ zIndex: z[i] }}
          >
            <div className="h-[58%] sm:h-[60%] md:h-[62%]">
              <Cover p={p} className="h-full w-full rounded-none" imgClassName="object-top" />
            </div>
            <div className="flex h-[42%] flex-col justify-start gap-1.5 p-2.5 sm:h-[40%] md:h-[38%] md:p-3">
              <div className="line-clamp-2 min-w-0 font-display text-[12px] font-bold leading-tight text-ink md:text-sm">
                {p.title}
              </div>
              <div className="flex min-w-0 flex-nowrap items-baseline gap-1.5 sm:gap-2">
                <span
                  className="shrink-0 font-display text-sm font-bold sm:text-lg md:text-xl"
                  style={{ color: "#B8860B" }}
                >
                  ${p.price.toFixed(2)}
                </span>
                {hasDiscount && (
                  <>
                    <span className="hidden truncate text-[11px] text-mute line-through sm:inline">
                      ${p.compareAtPrice!.toFixed(2)}
                    </span>
                    <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600 sm:text-[10px]">
                      -{pct}%
                    </span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Layered creator-dashboard mockup: top bar + stacked covers. */
function CreatorVisual({ items }: { items: HeroProduct[] }) {
  const list = items.slice(0, 3);
  while (list.length < 3) list.push(FALLBACK_STACK[list.length]);
  return (
    <div className="relative mx-auto h-[280px] w-[300px] sm:h-[340px] sm:w-[380px] md:h-[420px] md:w-[440px]">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-[28px] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201,168,76,0.45), rgba(201,168,76,0) 70%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6),0_0_0_1px_rgba(201,168,76,0.3)]"
      >
        {/* faux dashboard chrome */}
        <div className="flex items-center gap-1.5 border-b border-line bg-[#f9fafb] px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
          <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
          <span className="ml-2 text-[10px] font-semibold tracking-[0.18em] text-mute">
            CREATOR DASHBOARD
          </span>
        </div>
        <div className="p-3 md:p-4">
          <div className="mt-3 grid grid-cols-3 gap-2">
            {list.map((p, i) => (
              <motion.div
                key={p.id + i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                className="aspect-[3/4] overflow-hidden rounded-md ring-1 ring-line"
              >
                <Cover p={p} className="h-full w-full rounded-none" />
              </motion.div>
            ))}
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-[#eef0f3]">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-gold to-[#e6c76a]" />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-mute">
            <span>Sales</span>
            <span>Payouts monthly</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function HeroCarousel({
  heroProduct,
  dealsProducts,
  creatorProducts,
}: {
  heroProduct?: HeroProduct | null;
  dealsProducts?: HeroProduct[];
  creatorProducts?: HeroProduct[];
}) {
  const SLIDES: Slide[] = [HERO_SLIDE, DEALS_SLIDE, CREATOR_SLIDE];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const { activeTheme, setActiveTheme } = useTheme();

  const heroP: HeroProduct = heroProduct ?? FALLBACK_HERO;
  const dealsList = useMemo(
    () => (dealsProducts && dealsProducts.length ? dealsProducts : FALLBACK_STACK),
    [dealsProducts],
  );
  const creatorList = useMemo(
    () => (creatorProducts && creatorProducts.length ? creatorProducts : FALLBACK_STACK),
    [creatorProducts],
  );

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [paused, SLIDES.length]);

  const slide = SLIDES[i];

  useEffect(() => {
    setActiveTheme({
      ...activeTheme,
      accentColor: slide.theme.accentColor,
      gradientStart: slide.theme.gradientStart,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const next = () => setI((p) => (p + 1) % SLIDES.length);
  const prev = () => setI((p) => (p - 1 + SLIDES.length) % SLIDES.length);

  return (
    <section
      className="av-hero-bg av-hero-particles relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className="av-hero-reflection" aria-hidden />
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[55%_45%] md:gap-12 md:py-28 lg:px-8 lg:py-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={`text-${i}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45 }}
          >
            {slide.kicker && (
              <div
                className="text-[11px] font-semibold tracking-caps"
                style={{ color: "var(--accent-color)" }}
              >
                {slide.kicker}
              </div>
            )}
            <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[80px]">
              {slide.title}
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/75 md:text-xl">
              {slide.body}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link to={slide.ctaTo}>
                <motion.span
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className="btn-gold-premium inline-flex h-14 items-center rounded-2xl px-9 text-[15px] font-bold text-navy"
                >
                  {slide.ctaLabel}
                </motion.span>
              </Link>
              {slide.secondaryLabel && slide.secondaryHref && (
                <motion.a
                  whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.08)" }}
                  whileTap={{ scale: 0.97 }}
                  href={slide.secondaryHref}
                  className="inline-flex h-14 items-center rounded-2xl border border-white/40 px-9 text-[15px] font-bold text-white backdrop-blur-sm"
                >
                  {slide.secondaryLabel}
                </motion.a>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="relative flex min-h-[300px] items-center justify-center sm:min-h-[380px] md:min-h-[460px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`vis-${i}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.5 }}
              className="w-full"
            >
              {slide.kind === "hero" && <HeroVisual p={heroP} />}
              {slide.kind === "deals" && <DealsVisual items={dealsList} />}
              {slide.kind === "creator" && <CreatorVisual items={creatorList} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 md:flex"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 md:flex"
      >
        <ChevronRight size={20} />
      </button>

      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            aria-label={`Go to slide ${idx + 1}`}
            onClick={() => setI(idx)}
            {...(idx === i ? { "data-nav-dot": "true" } : {})}
            className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out ${
              idx === i ? "w-8" : "w-3 bg-white/30 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
