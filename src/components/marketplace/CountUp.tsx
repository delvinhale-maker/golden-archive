import { useEffect, useRef } from "react";

/**
 * Animates a number counting up from 0 when scrolled into view.
 *
 * Performance notes:
 * - Writes directly to the DOM via ref.textContent instead of setState, so the
 *   1400ms count-up doesn't trigger ~84 React re-renders per instance.
 * - Skips DOM writes when the rounded integer hasn't changed frame-to-frame.
 * - Disconnects the IntersectionObserver as soon as it fires (one-shot) and
 *   cancels the pending rAF on unmount.
 * - Respects prefers-reduced-motion by jumping straight to the end value.
 */
export function CountUp({
  end,
  duration = 1400,
  className,
  suffix = "",
  prefix = "",
}: {
  end: number;
  duration?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const format = (n: number) => `${prefix}${n}${suffix}`;
    // Seed initial content synchronously so SSR/first paint isn't empty.
    el.textContent = format(0);

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.textContent = format(end);
      return;
    }

    let rafId = 0;
    let last = -1;
    let started = false;

    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        const next = Math.round(end * eased);
        if (next !== last) {
          last = next;
          el.textContent = format(next);
        }
        if (t < 1) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started) {
            started = true;
            io.disconnect();
            run();
            break;
          }
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [end, duration, prefix, suffix]);

  return <span ref={ref} className={className} />;
}
