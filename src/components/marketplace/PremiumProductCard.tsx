import { Heart } from "lucide-react";
import { useState } from "react";

export type PremiumCardCategory =
  | "ebook"
  | "course"
  | "template"
  | "audio"
  | "digital-download";

export type PremiumCardBadge = "bestseller" | "new" | "none";

export interface PremiumProductCardProps {
  title: string;
  category: PremiumCardCategory;
  price: number;
  authorName: string;
  authorAvatar?: string;
  badge?: PremiumCardBadge;
  productId: string;
  onAddToCart?: () => void;
  onWishlist?: () => void;
}

// Brand palette
const NAVY = "#1B2A4A";
const PURPLE = "#4A1B6D";
const EMERALD = "#1B4A3A";
const EMERALD_DEEP = "#0D2E24";
const GOLD = "#C9A84C";
const GREY = "#F5F5F5";

// Deterministic seed → 0–360 hue shift / angle variation
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function categoryLabel(c: PremiumCardCategory): string {
  switch (c) {
    case "ebook":
      return "eBook";
    case "course":
      return "Course";
    case "template":
      return "Template";
    case "audio":
      return "Audio";
    case "digital-download":
      return "Digital";
  }
}

function CoverEbook({ title, seed }: { title: string; seed: number }) {
  const angle = 120 + (seed % 40); // 120–160deg
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: `linear-gradient(${angle}deg, ${NAVY} 0%, ${PURPLE} 100%)`,
      }}
    >
      {/* 5% noise texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.9'/></svg>\")",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <h3
          className="text-center font-serif text-lg leading-tight text-white line-clamp-4"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          {title}
        </h3>
      </div>
    </div>
  );
}

function CoverCourse({
  title,
  seed,
}: {
  title: string;
  seed: number;
}) {
  const angle = 135 + (seed % 30);
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: `linear-gradient(${angle}deg, ${EMERALD} 0%, ${EMERALD_DEEP} 100%)`,
      }}
    >
      <span
        className="absolute right-3 top-3 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ background: GOLD, color: NAVY }}
      >
        Course
      </span>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <h3 className="text-center text-base font-bold leading-tight text-white line-clamp-4">
          {title}
        </h3>
      </div>
    </div>
  );
}

function CoverTemplate({ title }: { title: string }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: GREY }}
    >
      {/* Wireframe grid lines */}
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full"
        style={{ opacity: 0.2 }}
      >
        <defs>
          <pattern
            id="wfgrid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke={NAVY}
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wfgrid)" />
      </svg>
      {/* Wireframe blocks */}
      <div className="absolute inset-x-6 top-6 space-y-2" style={{ opacity: 0.25 }}>
        <div className="h-3 w-1/3 rounded-sm" style={{ background: NAVY }} />
        <div className="h-2 w-2/3 rounded-sm" style={{ background: NAVY }} />
        <div className="h-2 w-1/2 rounded-sm" style={{ background: NAVY }} />
      </div>
      <h3
        className="absolute bottom-4 left-4 right-4 text-left text-sm font-bold leading-tight line-clamp-2"
        style={{ color: NAVY }}
      >
        {title}
      </h3>
    </div>
  );
}

function CoverAudio({ title }: { title: string }) {
  // CSS animated waveform — 24 bars
  const bars = Array.from({ length: 24 });
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
        <div className="flex h-12 items-center gap-[3px]">
          {bars.map((_, i) => (
            <span
              key={i}
              className="av-wave-bar inline-block w-[3px] rounded-full"
              style={{
                background: GOLD,
                animationDelay: `${(i * 80) % 1200}ms`,
              }}
            />
          ))}
        </div>
        <h3 className="mt-3 text-center text-sm font-semibold leading-tight text-white line-clamp-2">
          {title}
        </h3>
      </div>
      <style>{`
        @keyframes av-wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
        .av-wave-bar {
          height: 100%;
          transform-origin: center;
          animation: av-wave 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function CoverDigital({ title, seed }: { title: string; seed: number }) {
  const angle = 120 + (seed % 50);
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: `linear-gradient(${angle}deg, ${NAVY} 0%, ${GOLD} 100%)`,
        boxShadow: `inset 0 0 0 1px ${GOLD}`,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <h3
          className="text-center font-serif text-lg leading-tight text-white line-clamp-4"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          {title}
        </h3>
      </div>
    </div>
  );
}

function Cover({
  title,
  category,
  seed,
}: {
  title: string;
  category: PremiumCardCategory;
  seed: number;
}) {
  switch (category) {
    case "ebook":
      return <CoverEbook title={title} seed={seed} />;
    case "course":
      return <CoverCourse title={title} seed={seed} />;
    case "template":
      return <CoverTemplate title={title} />;
    case "audio":
      return <CoverAudio title={title} />;
    case "digital-download":
      return <CoverDigital title={title} seed={seed} />;
  }
}

export function PremiumProductCard({
  title,
  category,
  price,
  authorName,
  authorAvatar,
  badge = "none",
  productId,
  onAddToCart,
  onWishlist,
}: PremiumProductCardProps) {
  const [liked, setLiked] = useState(false);
  const seed = hashSeed(productId);

  const handleWishlist = () => {
    setLiked((v) => !v);
    onWishlist?.();
  };

  const initials = authorName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <article
      data-testid="product-tile"
      data-product-id={productId}
      className="group flex w-full min-w-0 flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,22,41,0.12)]"
    >
      {/* Cover */}
      <div className="relative h-[180px] w-full overflow-hidden">
        <Cover title={title} category={category} seed={seed} />

        {/* Badge top-left */}
        {badge === "bestseller" && (
          <span
            className="absolute left-3 top-3 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ background: GOLD }}
          >
            Bestseller
          </span>
        )}
        {badge === "new" && (
          <span
            className="absolute left-3 top-3 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ background: EMERALD }}
          >
            New
          </span>
        )}

        {/* Wishlist top-right */}
        <button
          type="button"
          onClick={handleWishlist}
          aria-label="Add to wishlist"
          aria-pressed={liked}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm transition-transform duration-150 hover:scale-110 active:scale-95"
        >
          <Heart
            size={15}
            stroke={liked ? GOLD : "#6b7280"}
            fill={liked ? GOLD : "none"}
            strokeWidth={2}
          />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: GOLD }}
        >
          {categoryLabel(category)}
        </div>

        <h3
          className="mt-1.5 line-clamp-2 min-h-[2.6em] break-words text-[15px] font-bold leading-snug"
          style={{ color: NAVY }}
        >
          {title}
        </h3>

        {/* Author */}
        <div className="mt-2 flex items-center gap-2">
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt={authorName}
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ background: NAVY }}
              aria-hidden
            >
              {initials}
            </div>
          )}
          <span className="text-[12px] text-[#6b7280]">{authorName}</span>
        </div>

        {/* Price */}
        <div className="mt-3 text-[18px] font-bold tabular-nums whitespace-nowrap" style={{ color: GOLD }}>
          ${price.toFixed(2)}
        </div>


        {/* CTA */}
        <button
          type="button"
          onClick={onAddToCart}
          className="mt-4 w-full rounded-full border-2 py-2.5 text-[13px] font-bold transition-colors duration-200"
          style={{
            borderColor: NAVY,
            color: NAVY,
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = NAVY;
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = NAVY;
          }}
        >
          Add to Cart
        </button>
      </div>
    </article>
  );
}

export default PremiumProductCard;
