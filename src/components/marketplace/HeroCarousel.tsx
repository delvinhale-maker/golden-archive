import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { ProductCover } from "./ProductCover";
import { useTheme } from "@/lib/theme/ThemeProvider";

type SlideTheme = { accentColor: string; gradientStart: string };

type Slide = {
  kicker: string;
  title: React.ReactNode;
  body: string;
  ctaLabel: string;
  ctaTo: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  card: { title: string; cat: string; price: number; coverUrl?: string | null };
  bgClass?: string;
  theme: SlideTheme;
};

const DEFAULT_HERO_SLIDE: Slide = {
  kicker: "",
  title: (
    <>
      Knowledge That <span className="gold-gradient">Moves You</span> Forward.
    </>
  ),
  body: "Premium digital resources for builders, leaders, and visionaries. Curated. Verified. Instant.",
  ctaLabel: "Shop Now →",
  ctaTo: "/products",
  secondaryLabel: "Browse Categories →",
  secondaryHref: "#categories",
  card: { title: "Kingdom Mind", cat: "eBook", price: 14.99 },
  theme: { accentColor: "#B8860B", gradientStart: "#0F1E35" },
};

const SECONDARY_SLIDES: Slide[] = [
  {
    kicker: "LIMITED TIME",
    title: (
      <>
        Today's <span className="gold-gradient">Best Deals</span>.
      </>
    ),
    body: "Hand-picked titles at exclusive prices — for a limited time only.",
    ctaLabel: "Shop Deals →",
    ctaTo: "/products",
    secondaryLabel: "Browse Categories →",
    secondaryHref: "#categories",
    card: { title: "The Stewardship Codex", cat: "eBook", price: 19 },
    theme: { accentColor: "#C9A84C", gradientStart: "#0F1629" },
  },
  {
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
    card: { title: "Your next drop", cat: "Creator", price: 49 },
    theme: { accentColor: "#C9A227", gradientStart: "#0F1629" },
  },
];

export type HeroProduct = {
  id: string;
  title: string;
  category: string;
  price: number;
  coverUrl?: string | null;
};

export function HeroCarousel({ heroProduct }: { heroProduct?: HeroProduct | null }) {
  const heroSlide: Slide = heroProduct
    ? {
        ...DEFAULT_HERO_SLIDE,
        card: {
          title: heroProduct.title,
          cat: heroProduct.category,
          price: heroProduct.price,
          coverUrl: heroProduct.coverUrl ?? null,
        },
      }
    : DEFAULT_HERO_SLIDE;
  const SLIDES: Slide[] = [heroSlide, ...SECONDARY_SLIDES];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const { activeTheme, setActiveTheme } = useTheme();

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [paused, SLIDES.length]);

  const slide = SLIDES[i];

  // Sync the global theme (accent + gradient) to the active slide
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
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-[55%_45%] md:py-28 lg:px-8 lg:py-36">
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

        <div className="relative mx-auto hidden h-[420px] w-full max-w-md md:block">
          <AnimatePresence mode="wait">
            <motion.div
              key={`card-${i}`}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.5 }}
              className="absolute right-0 top-4 w-80 overflow-hidden rounded-xl bg-white shadow-card-hover"
            >
              <div className="h-52 bg-[#f5f4ef]">
                {slide.card.coverUrl ? (
                  <img
                    src={slide.card.coverUrl}
                    alt={slide.card.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ProductCover
                    title={slide.card.title}
                    category={slide.card.cat}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="p-5">
                <div
                  className="text-[10px] font-semibold tracking-caps"
                  style={{ color: "var(--accent-color)" }}
                >
                  {slide.card.cat.toUpperCase()}
                </div>
                <div className="mt-1 font-display text-lg font-bold text-ink">
                  {slide.card.title}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className="font-display text-xl font-bold"
                    style={{ color: "var(--accent-color)" }}
                  >
                    ${slide.card.price}
                  </span>
                  <div className="flex items-center gap-1 text-[12px] text-mute">
                    <Star size={12} fill="var(--accent-color)" stroke="var(--accent-color)" /> 4.9
                  </div>
                </div>

              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
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

      {/* Dots */}
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
