import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductPreviewImage } from "@/lib/product-previews.functions";

type Props = {
  open: boolean;
  onClose: () => void;
  productTitle: string;
  previews: ProductPreviewImage[];
  price: number;
  ctaLabel?: string;
  onAddToCart: () => void;
  inCart?: boolean;
};

/**
 * Full-screen, swipeable carousel of pre-rendered watermarked preview
 * pages. Deep-navy background, gold page counter + CTA, cream close.
 * Sticky "Add to Cart — $X" CTA so the preview never dead-ends the
 * conversion funnel.
 */
export function ProductPreviewViewer({
  open,
  onClose,
  productTitle,
  previews,
  price,
  ctaLabel,
  onAddToCart,
  inCart,
}: Props) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const touchStartX = useRef<number | null>(null);
  const total = previews.length;

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);
  const goNext = useCallback(() => {
    setIndex((i) => (i < total - 1 ? i + 1 : i));
  }, [total]);

  // Reset on open, lock scroll while open.
  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setLoaded({});
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Keyboard nav.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  if (!open || total === 0) return null;

  const current = previews[index];
  const priceLabel = `$${price.toFixed(2)}`;
  const cta = ctaLabel ?? (inCart ? "✓ Added — View Cart" : `Add to Cart — ${priceLabel}`);

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview pages for ${productTitle}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col bg-[#0F1E35]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 text-[#F5F0E8]">
          <div className="min-w-0 pr-4">
            <p className="truncate text-sm font-semibold">{productTitle}</p>
            <p className="text-xs text-[#F5F0E8]/60">Sample pages</p>
          </div>
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-[#F5F0E8] hover:bg-white/10"
          >
            <X size={22} />
          </button>
        </div>

        {/* Slide area */}
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden px-2"
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current == null) return;
            const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
            touchStartX.current = null;
            if (dx > 40) goPrev();
            else if (dx < -40) goNext();
          }}
        >
          {/* Left arrow — desktop / tablet */}
          {index > 0 && (
            <button
              type="button"
              aria-label="Previous page"
              onClick={goPrev}
              className="absolute left-2 z-10 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[#F5F0E8] backdrop-blur hover:bg-white/20 sm:flex"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18 }}
              className="relative flex h-full w-full max-w-3xl items-center justify-center"
            >
              {!loaded[index] && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-full max-h-[70vh] w-full max-w-[520px] animate-pulse rounded-lg bg-white/5" />
                  <Loader2
                    size={28}
                    className="absolute animate-spin text-[#B8860B]"
                    aria-hidden
                  />
                </div>
              )}
              <img
                src={current.imageUrl}
                alt={current.altText ?? `${productTitle} — page ${current.pageOrder}`}
                loading="lazy"
                onLoad={() => setLoaded((s) => ({ ...s, [index]: true }))}
                className="max-h-[calc(100vh-200px)] max-w-full rounded-md object-contain shadow-2xl"
                style={{ opacity: loaded[index] ? 1 : 0 }}
                draggable={false}
              />
            </motion.div>
          </AnimatePresence>

          {/* Right arrow — desktop / tablet */}
          {index < total - 1 && (
            <button
              type="button"
              aria-label="Next page"
              onClick={goNext}
              className="absolute right-2 z-10 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[#F5F0E8] backdrop-blur hover:bg-white/20 sm:flex"
            >
              <ChevronRight size={22} />
            </button>
          )}
        </div>

        {/* Footer: counter + sticky CTA */}
        <div className="border-t border-white/5 bg-[#0F1E35] px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
          <div className="mb-3 flex items-center justify-center gap-3 text-sm">
            <button
              type="button"
              aria-label="Previous page"
              onClick={goPrev}
              disabled={index === 0}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#F5F0E8] disabled:opacity-30 sm:hidden"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="font-semibold tabular-nums text-[#B8860B]">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              aria-label="Next page"
              onClick={goNext}
              disabled={index === total - 1}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#F5F0E8] disabled:opacity-30 sm:hidden"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <button
            type="button"
            onClick={onAddToCart}
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#B8860B] text-sm font-bold text-[#0F1E35] shadow-lg hover:brightness-110"
          >
            {cta}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
