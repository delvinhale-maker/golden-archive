import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { ProductCover } from "./ProductCover";

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
};

const SECONDARY_SLIDES: Slide[] = [
  {
    kicker: "NEW THIS WEEK",
    title: (
      <>
        The <span className="gold-gradient">Sovereign Leadership</span> playbook is live.
      </>
    ),
    body: "A 12-module course for operators building with intention. Lifetime access, downloadable workbook, private community.",
    ctaLabel: "Enroll Now →",
    ctaTo: "/products",
    secondaryLabel: "View Curriculum →",
    secondaryHref: "/products",
    card: { title: "Sovereign Leadership", cat: "Course", price: 199 },
  },
  {
    kicker: "BECOME A SELLER",
    title: (
      <>
        Sell with <span className="gold-gradient">conviction</span>. Keep 91%.
      </>
    ),
    body: "Apply to sell on AurumVault and reach buyers who pay full price for purpose-built work.",
    ctaLabel: "Apply to Sell →",
    ctaTo: "/sell",
    secondaryLabel: "Explore the Store →",
    secondaryHref: "/products",
    card: { title: "Boardroom Liturgy", cat: "Audio", price: 29 },
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

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 6500);
    return () => clearInterval(t);
  }, [paused]);

  const slide = SLIDES[i];
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
            <div className="text-[11px] font-semibold tracking-caps text-gold">
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
                  className="inline-flex h-12 items-center rounded-full bg-gold px-7 text-sm font-bold text-navy shadow-gold-glow"
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
                <ProductCover
                  title={slide.card.title}
                  category={slide.card.cat}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-5">
                <div className="text-[10px] font-semibold tracking-caps text-gold">
                  {slide.card.cat.toUpperCase()}
                </div>
                <div className="mt-1 font-display text-lg font-bold text-ink">
                  {slide.card.title}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-display text-xl font-bold text-gold">
                    ${slide.card.price}
                  </span>
                  <div className="flex items-center gap-1 text-[12px] text-mute">
                    <Star size={12} fill="var(--gold)" stroke="var(--gold)" /> 4.9
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
            className={`h-1.5 rounded-full transition-all ${
              idx === i ? "w-8 bg-gold" : "w-3 bg-white/30 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
