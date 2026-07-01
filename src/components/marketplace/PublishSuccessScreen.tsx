import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { PublisherAccent } from "@/components/marketplace/PublisherShell";

/** How long confetti stays on screen after the success view mounts. */
export const CONFETTI_DURATION_MS = 3000;
/** Number of confetti pieces rendered. Exposed for tests. */
export const CONFETTI_PIECE_COUNT = 60;

export interface PublishSuccessScreenProps {
  productId: string;
  title: string;
  accent: PublisherAccent;
  cover: string | null;
  price: number;
}

/**
 * Post-publish confirmation shown after a title goes live on AurumVault.
 * Renders the cover, title/price, primary "View in Store" CTA, secondary
 * "Upload Another Title" CTA, and a 3-second confetti burst.
 */
export function PublishSuccessScreen({
  productId,
  title,
  accent,
  cover,
  price,
}: PublishSuccessScreenProps) {
  const [showConfetti, setShowConfetti] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), CONFETTI_DURATION_MS);
    return () => clearTimeout(t);
  }, []);
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_PIECE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2 + Math.random() * 1.5,
        hue: Math.floor(Math.random() * 360),
        size: 6 + Math.round(Math.random() * 6),
      })),
    [],
  );
  return (
    <div className="relative max-w-2xl mx-auto mt-12 text-center" data-testid="publish-success-screen">
      {showConfetti && (
        <div
          aria-hidden="true"
          data-testid="publish-success-confetti"
          className="pointer-events-none fixed inset-0 overflow-hidden z-40"
        >
          {pieces.map((p) => (
            <span
              key={p.id}
              className="absolute top-[-20px] block rounded-sm"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                background: `hsl(${p.hue} 85% 60%)`,
                animation: `av-fall ${p.dur}s ${p.delay}s linear forwards`,
              }}
            />
          ))}
          <style>{`@keyframes av-fall{to{transform:translateY(110vh) rotate(720deg);opacity:0}}`}</style>
        </div>
      )}
      {cover && (
        <img
          src={cover}
          alt={`Cover for ${title}`}
          className="mx-auto w-40 aspect-[1/1.6] object-cover rounded-md shadow-2xl border border-ink/10"
        />
      )}
      <h1 className="mt-6 font-display text-3xl md:text-4xl text-navy">
        🎉 Your title is live on AurumVault!
      </h1>
      <p className="mt-3 text-navy font-medium">"{title}"</p>
      {price > 0 && (
        <p className="text-mute mt-1">
          Listed at{" "}
          <span className="font-mono font-semibold text-navy">
            ${price.toFixed(2)}
          </span>
        </p>
      )}
      <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/products/$id"
          params={{ id: productId }}
          data-testid="publish-success-view-in-store"
          className="h-12 px-6 rounded-full font-semibold text-white inline-flex items-center justify-center gap-2"
          style={{ background: accent.color }}
        >
          View in Store <ArrowRight size={16} />
        </Link>
        <a
          href="/dashboard/new"
          data-testid="publish-success-upload-another"
          className="h-12 px-6 rounded-full font-semibold text-navy border border-navy/20 inline-flex items-center justify-center hover:bg-navy/5"
        >
          Upload Another Title
        </a>
      </div>
      <Link
        to="/dashboard"
        className="mt-4 inline-block text-sm text-mute hover:text-navy underline"
      >
        Back to Bookshelf
      </Link>
    </div>
  );
}
