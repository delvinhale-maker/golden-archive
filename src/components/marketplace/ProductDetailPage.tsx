import { useEffect, useState } from "react";
import { useTrackView } from "@/hooks/use-recently-viewed";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { CATEGORY_THEMES } from "@/lib/theme/theme-config";

import {
  BadgeCheck,
  ChevronRight,
  Download,
  Heart,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
} from "lucide-react";
import {
  PremiumProductCard,
  type PremiumCardCategory,
  type PremiumCardBadge,
} from "./PremiumProductCard";

const NAVY = "#1B2A4A";
const NAVY_DEEP = "#11192E";
const PURPLE = "#4A1B6D";
const EMERALD = "#1B4A3A";
const EMERALD_DEEP = "#0D2E24";
const TEAL = "#1F6B6B";
const GREY = "#F5F5F5";
const GOLD = "#C9A84C";

interface Creator {
  name: string;
  photo?: string;
  bio: string;
  productCount: number;
  verified?: boolean;
}

interface RelatedProduct {
  productId: string;
  title: string;
  category: PremiumCardCategory;
  price: number;
  authorName: string;
  authorAvatar?: string;
  badge?: PremiumCardBadge;
}

export interface ProductDetailPageProps {
  productId: string;
  title: string;
  category: PremiumCardCategory;
  categoryLabel: string;
  breadcrumb?: { label: string; href?: string }[];
  rating: number;
  reviewCount: number;
  description: string;
  longDescription?: string;
  whatsIncluded?: string[];
  price: number;
  compareAtPrice?: number;
  creator: Creator;
  related?: RelatedProduct[];
  onAddToCart?: () => void;
  onWishlist?: () => void;
  onViewStore?: () => void;
}

function hashSeed(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function LargeCover({
  title,
  category,
  productId,
}: {
  title: string;
  category: PremiumCardCategory;
  productId: string;
}) {
  const seed = hashSeed(productId);
  let bg = "";
  let textClass = "font-serif text-white";
  let style: React.CSSProperties = {};

  if (category === "ebook") {
    bg = `linear-gradient(${120 + (seed % 40)}deg, ${NAVY} 0%, ${PURPLE} 100%)`;
  } else if (category === "course") {
    bg = `linear-gradient(${135 + (seed % 30)}deg, ${EMERALD} 0%, ${EMERALD_DEEP} 100%)`;
  } else if (category === "template") {
    bg = GREY;
    textClass = "font-bold";
    style = { color: NAVY };
  } else if (category === "audio") {
    bg = "#000000";
  } else {
    bg = `linear-gradient(${120 + (seed % 50)}deg, ${NAVY} 0%, ${GOLD} 100%)`;
  }

  return (
    <div
      className="relative h-[400px] w-full overflow-hidden rounded-2xl ring-1 ring-black/5"
      style={{
        background: bg,
        boxShadow: `0 30px 60px -25px ${GOLD}55, 0 10px 25px -10px rgba(0,0,0,0.25)`,
      }}
    >
      {category === "ebook" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
      )}
      {category === "course" && (
        <span
          className="absolute right-5 top-5 rounded-sm px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
          style={{ background: GOLD, color: NAVY }}
        >
          Course
        </span>
      )}
      {category === "template" && (
        <>
          <svg aria-hidden className="absolute inset-0 h-full w-full opacity-20">
            <defs>
              <pattern id="pdwf" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M28 0 L0 0 0 28" fill="none" stroke={NAVY} strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pdwf)" />
          </svg>
          <div className="absolute inset-x-10 top-10 space-y-2.5 opacity-25">
            <div className="h-4 w-1/3 rounded-sm" style={{ background: NAVY }} />
            <div className="h-2.5 w-2/3 rounded-sm" style={{ background: NAVY }} />
            <div className="h-2.5 w-1/2 rounded-sm" style={{ background: NAVY }} />
          </div>
        </>
      )}
      {category === "audio" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 items-center gap-1">
            {Array.from({ length: 32 }).map((_, i) => (
              <span
                key={i}
                className="inline-block w-[4px] rounded-full av-pd-wave"
                style={{
                  background: GOLD,
                  animationDelay: `${(i * 70) % 1400}ms`,
                }}
              />
            ))}
          </div>
        </div>
      )}
      {category === "digital-download" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 ring-1 ring-inset"
          style={{ boxShadow: `inset 0 0 0 1px ${GOLD}` }}
        />
      )}

      {category === "template" ? (
        <h2
          className={`absolute inset-x-8 bottom-8 text-2xl leading-tight ${textClass}`}
          style={style}
        >
          {title}
        </h2>
      ) : category === "audio" ? (
        <h2 className="absolute inset-x-8 bottom-10 text-center text-2xl font-semibold leading-tight text-white">
          {title}
        </h2>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-10">
          <h2
            className="text-center text-3xl leading-tight text-white"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {title}
          </h2>
        </div>
      )}

      <style>{`
        @keyframes av-pd-wave { 0%,100%{transform:scaleY(0.3)} 50%{transform:scaleY(1)} }
        .av-pd-wave { height:100%; transform-origin:center; animation: av-pd-wave 1.3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function StarRow({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={16}
            fill={i < Math.round(rating) ? GOLD : "none"}
            stroke={GOLD}
            strokeWidth={1.5}
          />
        ))}
      </div>
      <span className="text-sm font-medium" style={{ color: NAVY }}>
        {rating.toFixed(1)}
      </span>
      <span className="text-sm text-[#6b7280]">({count} reviews)</span>
    </div>
  );
}

function TrustBadge({
  icon: Icon,
  label,
}: {
  icon: typeof Download;
  label: string;
}) {
  return (
    <div
      className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2.5"
      style={{ borderColor: "#E5E7EB", background: "#FAFAF7" }}
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
        style={{ background: `${GOLD}1A`, border: `1px solid ${GOLD}55` }}
      >
        <Icon size={14} style={{ color: GOLD }} />
      </span>
      <span className="truncate text-[12px] font-semibold" style={{ color: NAVY }}>
        {label}
      </span>
    </div>
  );
}

type TabKey = "description" | "included" | "creator";

export function ProductDetailPage(props: ProductDetailPageProps) {
  const {
    productId,
    title,
    category,
    categoryLabel,
    breadcrumb,
    rating,
    reviewCount,
    description,
    longDescription,
    whatsIncluded = [],
    price,
    compareAtPrice,
    creator,
    related = [],
    onAddToCart,
    onWishlist,
    onViewStore,
  } = props;

  const [tab, setTab] = useState<TabKey>("description");
  const [liked, setLiked] = useState(false);
  useTrackView(productId);

  // Sync the global accent color to the product's category theme
  const { activeTheme, setActiveTheme } = useTheme();
  useEffect(() => {
    const key = (categoryLabel || category || "").toString().toLowerCase();
    const catTheme =
      CATEGORY_THEMES[key] ||
      CATEGORY_THEMES[key.replace(/s$/, "")] ||
      CATEGORY_THEMES[key + "s"];
    if (catTheme) {
      setActiveTheme({
        ...activeTheme,
        accentColor: catTheme.accentColor,
        gradientStart: catTheme.gradientStart,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, categoryLabel]);



  const crumbs = breadcrumb ?? [
    { label: "Home" },
    { label: categoryLabel },
    { label: title },
  ];

  return (
    <div className="w-full bg-white pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
      {/* Navy top bar with breadcrumb */}
      <div style={{ background: NAVY }}>
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto px-4 py-3 sm:px-6">
          {crumbs.map((c, i) => (
            <div key={i} className="flex shrink-0 items-center gap-1.5">
              {i > 0 && (
                <ChevronRight size={14} className="text-white/40" />
              )}
              <span
                className={`text-[12px] ${
                  i === crumbs.length - 1
                    ? "font-semibold text-white"
                    : "text-white/70 hover:text-white"
                }`}
                style={i === crumbs.length - 1 ? { color: GOLD } : undefined}
              >
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid grid-cols-1 gap-10 lg:[grid-template-columns:45fr_55fr]">
          {/* Cover */}
          <div className="min-w-0">
            <LargeCover title={title} category={category} productId={productId} />
          </div>

          {/* Info */}
          <div className="min-w-0">
            <span
              className="inline-block rounded-sm px-2 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{ background: `${GOLD}1A`, color: GOLD }}
            >
              {categoryLabel}
            </span>

            <h1
              className="mt-3 text-3xl font-bold leading-tight sm:text-4xl"
              style={{ color: NAVY }}
            >
              {title}
            </h1>

            <div className="mt-3">
              <StarRow rating={rating} count={reviewCount} />
            </div>

            <p className="mt-5 text-[15px] leading-relaxed text-[#4b5563]">
              {description}
            </p>

            <div
              data-testid="pdp-price-block"
              className="mt-6 flex items-baseline gap-3"
            >
              <span
                data-testid="pdp-price"
                className="text-4xl font-bold"
                style={{ color: GOLD }}
              >
                ${price.toFixed(2)}
              </span>
              {compareAtPrice && compareAtPrice > price && (
                <span
                  data-testid="pdp-compare-at"
                  className="text-lg text-[#9ca3af] line-through"
                >
                  ${compareAtPrice.toFixed(2)}
                </span>
              )}
              {compareAtPrice && compareAtPrice > price && (
                <span
                  className="rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
                  style={{ background: EMERALD, color: "#fff" }}
                >
                  Save ${(compareAtPrice - price).toFixed(0)}
                </span>
              )}
            </div>

            {/* Trust badges */}
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <TrustBadge icon={Download} label="Instant Download" />
              <TrustBadge icon={ShieldCheck} label="Secure Checkout" />
              <TrustBadge icon={RefreshCcw} label="Money Back" />
            </div>

            {/* CTAs */}
            <div className="mt-7 space-y-3">
              <button
                type="button"
                onClick={onAddToCart}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-bold transition-all duration-200 hover:shadow-[0_18px_40px_-12px_rgba(201,168,76,0.55)] active:scale-[0.99]"
                style={{ background: GOLD, color: NAVY }}
              >
                <ShoppingCart size={16} />
                Add to Cart
              </button>
              <button
                type="button"
                onClick={() => {
                  setLiked((v) => !v);
                  onWishlist?.();
                }}
                aria-pressed={liked}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 py-3.5 text-sm font-bold transition-colors duration-200"
                style={{
                  borderColor: NAVY,
                  color: liked ? "#fff" : NAVY,
                  background: liked ? NAVY : "transparent",
                }}
              >
                <Heart size={15} fill={liked ? GOLD : "none"} stroke={liked ? GOLD : "currentColor"} />
                {liked ? "Added to Wishlist" : "Add to Wishlist"}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-14">
          <div
            className="flex gap-1 border-b"
            style={{ borderColor: "#E5E7EB" }}
            role="tablist"
          >
            {(
              [
                { k: "description", label: "Description" },
                { k: "included", label: "What's Included" },
                { k: "creator", label: "About the Creator" },
              ] as { k: TabKey; label: string }[]
            ).map((t) => {
              const active = tab === t.k;
              return (
                <button
                  key={t.k}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.k)}
                  className="relative px-4 py-3 text-sm font-semibold transition-colors"
                  style={{
                    color: active ? NAVY : "#6b7280",
                  }}
                >
                  {t.label}
                  {active && (
                    <span
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                      style={{ background: GOLD }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="py-8">
            {tab === "description" && (
              <div className="max-w-3xl space-y-4 text-[15px] leading-relaxed text-[#4b5563]">
                <p>{longDescription ?? description}</p>
              </div>
            )}
            {tab === "included" && (
              <ul className="max-w-2xl space-y-3">
                {(whatsIncluded.length
                  ? whatsIncluded
                  : [
                      "Full digital download",
                      "Lifetime access",
                      "Bonus resources",
                    ]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full"
                      style={{ background: `${GOLD}1A` }}
                    >
                      <BadgeCheck size={14} style={{ color: GOLD }} />
                    </span>
                    <span className="text-[15px]" style={{ color: NAVY }}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {tab === "creator" && (
              <CreatorCard creator={creator} onViewStore={onViewStore} />
            )}
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-10">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
                Related Products
              </h2>
              <div
                className="hidden h-px flex-1 sm:block"
                style={{
                  background: `linear-gradient(90deg, transparent, ${GOLD}55, transparent)`,
                }}
              />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.slice(0, 4).map((r) => (
                <PremiumProductCard key={r.productId} {...r} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile sticky Add to Cart CTA */}
      <div
        className="fixed inset-x-0 z-40 border-t border-black/10 bg-white/95 px-4 pt-3 backdrop-blur md:hidden"
        style={{
          bottom: "64px",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
          boxShadow: "0 -8px 24px -12px rgba(17,25,46,0.18)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-black/50">
              {categoryLabel}
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="font-display text-lg font-bold"
                style={{ color: NAVY }}
              >
                ${price.toFixed(2)}
              </span>
              {compareAtPrice && compareAtPrice > price && (
                <span className="text-xs text-black/40 line-through">
                  ${compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onAddToCart}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-[0_10px_28px_-10px_rgba(201,168,76,0.7)] active:scale-[0.98]"
            style={{ background: GOLD, color: NAVY }}
            aria-label="Add to cart"
          >
            <ShoppingCart size={16} />
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatorCard({
  creator,
  onViewStore,
}: {
  creator: Creator;
  onViewStore?: () => void;
}) {
  const initials = creator.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: "#E5E7EB" }}
    >
      <div
        className="h-28 w-full"
        style={{
          background: `linear-gradient(135deg, ${TEAL} 0%, ${NAVY_DEEP} 100%)`,
        }}
      />
      <div className="relative px-6 pb-6">
        <div
          className="relative -mt-12 mb-4 grid h-24 w-24 place-items-center overflow-hidden rounded-full ring-4 ring-white"
          style={{ background: NAVY }}
        >
          {creator.photo ? (
            <img
              src={creator.photo}
              alt={creator.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-2xl font-bold text-white">{initials}</span>
          )}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-xl font-bold" style={{ color: NAVY }}>
                {creator.name}
              </h3>
            </div>
            {/* Product count intentionally hidden on public creator card. */}

            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[#4b5563]">
              {creator.bio}
            </p>
          </div>

          <button
            type="button"
            onClick={onViewStore}
            className="shrink-0 rounded-full border-2 px-5 py-2.5 text-[13px] font-bold transition-colors duration-200"
            style={{ borderColor: GOLD, color: GOLD, background: "transparent" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = GOLD;
              e.currentTarget.style.color = NAVY;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = GOLD;
            }}
          >
            View Store
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductDetailPage;
