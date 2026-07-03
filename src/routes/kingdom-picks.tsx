import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, X, Info } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { AffiliateCard } from "@/components/marketplace/AffiliateCard";
import {
  fetchAffiliateProducts,
  AFFILIATE_CATEGORIES,
  type AffiliateProduct,
} from "@/lib/affiliate";

export const Route = createFileRoute("/kingdom-picks")({
  head: () => ({
    meta: [
      { title: "👑 Kingdom Picks — Curated Resources | AurumVault" },
      {
        name: "description",
        content:
          "Curated Kingdom-centered books, courses, and resources we recommend from trusted partners including Amazon and Walmart.",
      },
      { property: "og:title", content: "Kingdom Picks — AurumVault" },
      {
        property: "og:description",
        content:
          "Resources we trust and recommend for your Kingdom journey. Affiliate-supported.",
      },
    ],
  }),
  component: KingdomPicksPage,
});

type Filter = "All" | "Amazon" | "Walmart" | (typeof AFFILIATE_CATEGORIES)[number];
type Sort = "featured" | "price-asc" | "price-desc" | "newest";

const FILTERS: Filter[] = [
  "All",
  "Amazon",
  "Walmart",
  "eBooks",
  "Finance",
  "Leadership",
  "Purpose",
  "Children",
];

function KingdomPicksPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["affiliate", "page"],
    queryFn: () => fetchAffiliateProducts({ activeOnly: true, featuredFirst: true }),
  });
  const [filter, setFilter] = useState<Filter>("All");
  const [sort, setSort] = useState<Sort>("featured");
  const [dismissed, setDismissed] = useState(false);

  const items = useMemo(() => {
    let arr: AffiliateProduct[] = data ?? [];
    if (filter === "Amazon") arr = arr.filter((p) => p.source === "amazon");
    else if (filter === "Walmart") arr = arr.filter((p) => p.source === "walmart");
    else if (filter !== "All") arr = arr.filter((p) => p.category === filter);

    const sorted = [...arr];
    if (sort === "price-asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === "price-desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    else if (sort === "newest")
      sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else
      sorted.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return +new Date(b.created_at) - +new Date(a.created_at);
      });
    return sorted;
  }, [data, filter, sort]);

  return (
    <MarketShell>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        {!dismissed && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/40 bg-paper p-4 text-sm text-ink/80">
            <Info size={18} className="mt-0.5 shrink-0 text-gold" />
            <p className="flex-1">
              <strong className="text-navy">Disclosure:</strong> AurumVault earns
              a commission on purchases made through partner links on this page.
              Curated by AurumVault at no extra cost to you.{" "}
              <Link to="/affiliate-disclosure" className="text-gold underline">
                Learn more
              </Link>
              .
            </p>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss disclosure"
              className="rounded-full p-1 text-mute hover:bg-white"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <header className="mb-8">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-caps text-gold">
            <Crown size={14} /> KINGDOM PICKS
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold text-navy md:text-4xl">
            👑 Kingdom Picks
          </h1>
          <p className="mt-2 max-w-2xl text-mute">
            Resources we trust and recommend for your Kingdom journey.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  filter === f
                    ? "bg-navy text-gold"
                    : "border border-line bg-white text-ink hover:border-gold"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="ml-auto rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink focus:border-gold focus:outline-none"
          >
            <option value="featured">Featured First</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-12 text-center text-mute">
            No Kingdom Picks in this category yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
            {items.map((p) => (
              <AffiliateCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </MarketShell>
  );
}
