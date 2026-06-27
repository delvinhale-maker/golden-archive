import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles, Clock, Megaphone, Flame } from "lucide-react";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { getHomeRows, getProductsByIds } from "@/lib/home-rows.functions";
import type { Product } from "@/lib/marketplace.functions";

function Row({
  title,
  kicker,
  icon: Icon,
  products,
  loading,
  empty,
  accent = "var(--gold)",
}: {
  title: string;
  kicker?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  products: Product[];
  loading?: boolean;
  empty?: React.ReactNode;
  accent?: string;
}) {
  if (!loading && products.length === 0 && !empty) return null;
  return (
    <section className="bg-white py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            {kicker && (
              <div
                className="text-[11px] font-semibold tracking-caps"
                style={{ color: accent }}
              >
                {kicker}
              </div>
            )}
            <h2 className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-ink md:text-3xl">
              <Icon size={22} className="text-gold" /> {title}
            </h2>
          </div>
          <Link
            to="/products"
            className="hidden text-xs font-bold uppercase tracking-caps text-navy hover:text-gold sm:inline"
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
          <div className="rounded-xl border border-line bg-[#fafaf7] p-6 text-center text-sm text-mute">
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
  const { data, isLoading } = useQuery({
    queryKey: ["mp", "home-rows"],
    queryFn: () => getHomeRows(),
    staleTime: 60_000,
  });

  return (
    <>
      <Row
        icon={Sparkles}
        kicker="JUST IN"
        title="New Releases"
        products={data?.newReleases ?? []}
        loading={isLoading}
        accent="var(--gold)"
      />
      <Row
        icon={Megaphone}
        kicker="SPONSORED"
        title="Promoted Picks"
        products={data?.sponsored ?? []}
        loading={isLoading}
      />
      <Row
        icon={Flame}
        kicker="RECOMMENDED FOR YOU"
        title="You May Also Like"
        products={data?.recommended ?? []}
        loading={isLoading}
      />
    </>
  );
}
