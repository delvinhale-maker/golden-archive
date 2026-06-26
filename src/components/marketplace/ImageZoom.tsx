import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZoomIn, X } from "lucide-react";

/**
 * Hover-to-zoom (desktop) with click-to-open full-screen lightbox.
 * Children render the cover. Provide an `expandedSrc` for the lightbox image,
 * or pass `renderExpanded` for non-image content.
 */
export function ImageZoom({
  children,
  renderExpanded,
  ariaLabel = "Product image",
}: {
  children: React.ReactNode;
  renderExpanded?: () => React.ReactNode;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [open, setOpen] = useState(false);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x, y });
  };

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseMove={onMove}
        onClick={() => setOpen(true)}
        className="group relative h-[360px] w-full cursor-zoom-in overflow-hidden rounded-xl bg-[#f5f4ef] md:h-[460px]"
        role="button"
        aria-label={`${ariaLabel} – click to enlarge`}
      >
        <motion.div
          animate={{ scale: hover ? 1.5 : 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          style={{ transformOrigin: `${pos.x}% ${pos.y}%` }}
          className="h-full w-full"
        >
          {children}
        </motion.div>
        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-caps text-white opacity-0 transition-opacity group-hover:opacity-100">
          <ZoomIn size={11} /> Zoom
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-6"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X size={20} />
            </button>
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-3xl"
            >
              {renderExpanded ? renderExpanded() : children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
