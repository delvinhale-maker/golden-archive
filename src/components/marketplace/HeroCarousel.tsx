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
  kicker: "FEATURED — ILLUSTRIOUS CAPITAL™",
  title: (
    <>
      Renew your mind. <span className="gold-gradient">Kingdom Mind</span> is here.
    </>
  ),
  body: "A purpose-driven eBook from Illustrious Capital™ — built to elevate operators, leaders, and creators walking in their calling.",
  ctaLabel: "Shop Now →",
  ctaTo: "/products",
  secondaryLabel: "Browse Categories →",
  secondaryHref: "#categories",
  card: { title: "Kingdom Mind", cat: "eBook", price: 14.99 },
  theme: { accentColor: "#B8860B", gradientStart: "#0F1E35" },
};

const SECONDARY_SLIDES: Slide[] = [
  {
    kicker: "DEALS OF THE DAY",
    title: (
      <>
        Deals of the <span className="gold-gradient">Day</span> — limited time savings.
      </>
    ),
    body: "Featured picks at lower prices for a limited time. Grab a title before the timer runs out.",
    ctaLabel: "Shop Deals →",
    ctaTo: "/products",
    secondaryLabel: "Browse All →",
    secondaryHref: "/products",
    card: { title: "Sovereign Leadership", cat: "Course", price: 199 },
    theme: { accentColor: "#B8860B", gradientStart: "#1A1000" },
  },
  {
    kicker: "AURUMVAULT PREMIUM",
    title: (
      <>
        Unlock <span className="gold-gradient">AurumVault Premium</span>.
      </>
    ),
    body: "Members-only pricing, early access to launches, and exclusive downloads across the vault.",
    ctaLabel: "Join Premium →",
    ctaTo: "/products",
    secondaryLabel: "Explore the Store →",
    secondaryHref: "/products",
    card: { title: "Boardroom Liturgy", cat: "Audio", price: 29 },
    theme: { accentColor: "#4B2D8F", gradientStart: "#1A0A2E" },
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
      className="av-hero-bg relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[55%_45%] md:py-24 lg:px-8 lg:py-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={`text-${i}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45 }}
          >
            <div
              className="text-[11px] font-semibold tracking-caps"
              style={{ color: "var(--accent-color)" }}
            >
              {slide.kicker}
            </div>
            <h1 className="mt-6 font-display text-4xl leading-[1.05] text-white sm:text-5xl md:text-6xl lg:text-[64px]">
              {slide.title}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
              {slide.body}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={slide.ctaTo}>
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex h-12 items-center rounded-full px-7 text-sm font-bold text-navy"
                  style={{
                    backgroundColor: "var(--accent-color)",
                    boxShadow:
                      "0 10px 30px -8px color-mix(in srgb, var(--accent-color) 55%, transparent)",
                  }}
                >
                  {slide.ctaLabel}
                </motion.span>
              </Link>
              {slide.secondaryLabel && slide.secondaryHref && (
                <motion.a
                  whileHover={{ scale: 1.02, backgroundColor: "#fff", color: "#0f1629" }}
                  whileTap={{ scale: 0.97 }}
                  href={slide.secondaryHref}
                  className="inline-flex h-12 items-center rounded-full border border-white/70 px-7 text-sm font-bold text-white"
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
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx === i ? "w-8" : "w-3 bg-white/30 hover:bg-white/60"
            }`}
            style={idx === i ? { backgroundColor: "var(--accent-color)" } : undefined}
          />
        ))}
      </div>
    </section>
  );
}
