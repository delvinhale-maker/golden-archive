import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles, Clock, Megaphone, Flame } from "lucide-react";
import { useEffect, useRef } from "react";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { getHomeRows, getProductsByIds } from "@/lib/homerows.functions";
import type { Product } from "@/lib/marketplace.functions";

type Scheme = {
  bg: string;
  fg: string;
  muted: string;
  kicker: string;
  border: string;
};

const SCHEMES: Record<"darkNavy" | "lightCream" | "darkOnyx", Scheme> = {
  darkNavy: {
    bg: "#0F1E35",
    fg: "#ffffff",
    muted: "rgba(255,255,255,0.72)",
    kicker: "#E3C25B",
    border: "rgba(255,255,255,0.10)",
  },
  lightCream: {
    bg: "#F5EFE0",
    fg: "#0F1E35",
    muted: "rgba(15,30,53,0.70)",
    kicker: "#9A7A14",
    border: "rgba(15,30,53,0.10)",
  },
  darkOnyx: {
    bg: "#0A0A0A",
    fg: "#ffffff",
    muted: "rgba(255,255,255,0.72)",
    kicker: "#C9A227",
    border: "rgba(255,255,255,0.10)",
  },
};

function applyScheme(s: Scheme) {
  if (typeof document === "undefined") return;
  const r = document.documentElement.style;
  r.setProperty("--scheme-bg", s.bg);
  r.setProperty("--scheme-fg", s.fg);
  r.setProperty("--scheme-muted", s.muted);
  r.setProperty("--scheme-kicker", s.kicker);
  r.setProperty("--scheme-border", s.border);
}

export const homeRowsQ = queryOptions({
  queryKey: ["mp", "home-rows"],
  queryFn: () => getHomeRows(),
  staleTime: 60_000,
});


function Row({
  title,
  kicker,
  icon: Icon,
  products,
  loading,
  empty,
  scheme = "darkNavy",
}: {
  title: string;
  kicker?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  products: Product[];
  loading?: boolean;
  empty?: React.ReactNode;
  scheme?: keyof typeof SCHEMES;
}) {
  const ref = useRef<HTMLElement | null>(null);
  // Scheme selection is handled globally by SchemeScrollSync below.

  if (!loading && products.length === 0 && !empty) {
    empty = "New picks coming soon.";
  }

  return (
    <section
      ref={ref}
      data-scheme={scheme}
      className="scheme-surface py-10 md:py-14"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            {kicker && (
              <div
                className="text-[11px] font-semibold tracking-caps transition-colors duration-500"
                style={{ color: "var(--scheme-kicker)" }}
              >
                {kicker}
              </div>
            )}
            <h2
              className="mt-1 flex items-center gap-2 font-display text-2xl font-bold md:text-3xl transition-colors duration-500"
              style={{ color: "var(--scheme-fg)" }}
            >
              <span style={{ color: "var(--scheme-kicker)", display: "inline-flex" }}>
                <Icon size={22} />
              </span>{" "}
              {title}
            </h2>
          </div>
          <Link
            to="/products"
            className="hidden text-xs font-bold uppercase tracking-caps transition-colors duration-500 sm:inline"
            style={{ color: "var(--scheme-kicker)" }}
          >
            See all →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center text-sm transition-colors duration-500"
            style={{
              border: "1px solid var(--scheme-border)",
              color: "var(--scheme-muted)",
              background: "color-mix(in oklab, var(--scheme-fg) 4%, transparent)",
            }}
          >
            {empty}
          </div>
        ) : (
          <div className="-mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-2 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-4">
            {products.slice(0, 8).map((p, i) => (
              <div
                key={p.id}
                className="w-[44vw] max-w-[200px] flex-shrink-0 snap-start md:w-auto md:max-w-none"
              >
                <ProductCard product={p} index={i} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function ContinueBrowsingRow() {
  const ids = useRecentlyViewed();
  const { data, isLoading } = useQuery({
    queryKey: ["mp", "recently-viewed", ids.join(",")],
    queryFn: () => getProductsByIds({ data: { ids } }),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
  if (ids.length === 0) return null;
  return (
    <Row
      icon={Clock}
      kicker="PICK UP WHERE YOU LEFT OFF"
      title="Continue Browsing"
      products={data ?? []}
      loading={isLoading}
    />
  );
}

export function HomeContentRows() {
  const { data } = useSuspenseQuery(homeRowsQ);


  return (
    <>
      <Row
        icon={Sparkles}
        kicker="JUST IN"
        title="New Releases"
        products={data.newReleases}
        scheme="darkNavy"
      />
      <Row
        icon={Megaphone}
        kicker="SPONSORED — ILLUSTRIOUS CAPITAL™"
        title="Promoted Picks"
        products={data.sponsored}
        scheme="lightCream"
      />
      <Row
        icon={Flame}
        kicker="RECOMMENDED FOR YOU"
        title="You May Also Like"
        products={data.recommended}
        scheme="darkOnyx"
      />
    </>
  );
}
