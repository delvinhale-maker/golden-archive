import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search as SearchIcon, X, Clock, Flame, Crown } from "lucide-react";
import { z } from "zod";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ProductCard, ProductCardSkeleton } from "@/components/marketplace/ProductCard";
import { AffiliateCard } from "@/components/marketplace/AffiliateCard";
import { getProducts } from "@/lib/marketplace.functions";
import { fetchAffiliateProducts } from "@/lib/affiliate";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export const Route = createFileRoute("/search")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Search — AurumVault" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SearchPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback error={error} reset={reset} title="Search isn't loading" />
  ),
});

const RECENT_KEY = "av:recent-searches";
const TRENDING = [
  "Kingdom Mind",
  "Money Smart",
  "Leadership",
  "Templates",
  "Courses",
  "Audio",
];
const CATEGORIES = ["eBooks", "Courses", "Templates", "Audio", "Finance", "Leadership"];

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}
function writeRecent(list: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
}

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState(search.q ?? "");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      navigate({
        to: "/search",
        search: q ? { q } : ({} as never),
        replace: true,
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q, navigate]);

  const query = useQuery({
    queryKey: ["mp", "search", q],
    queryFn: () => getProducts({ data: { q: q.trim(), page: 1 } }),
    placeholderData: keepPreviousData,
    enabled: q.trim().length > 0,
  });

  const affiliateQuery = useQuery({
    queryKey: ["affiliate", "search-pool"],
    queryFn: () => fetchAffiliateProducts({ activeOnly: true, featuredFirst: true }),
    staleTime: 5 * 60_000,
    enabled: q.trim().length > 0,
  });

  const results = query.data?.items ?? [];
  const affiliateMatches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return (affiliateQuery.data ?? []).filter((p) =>
      `${p.title} ${p.description} ${p.category}`.toLowerCase().includes(needle),
    );
  }, [q, affiliateQuery.data]);
  const hasQuery = q.trim().length > 0;

  // Persist on successful results
  useEffect(() => {
    if (!hasQuery || query.isFetching || results.length === 0) return;
    const term = q.trim();
    const next = [term, ...readRecent().filter((s) => s.toLowerCase() !== term.toLowerCase())];
    writeRecent(next);
    setRecent(next.slice(0, 8));
  }, [hasQuery, query.isFetching, results.length, q]);

  const clearRecent = () => {
    writeRecent([]);
    setRecent([]);
  };

  return (
    <MarketShell>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <div className="relative">
          <SearchIcon
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mute"
          />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search eBooks, courses, templates, creators..."
            className="h-14 w-full rounded-full border border-line bg-white pl-12 pr-12 text-base text-ink shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-mute hover:bg-muted"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {!hasQuery && (
          <div className="mt-8 space-y-8">
            {recent.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-caps text-mute">
                    <Clock size={12} /> Recent searches
                  </h2>
                  <button
                    onClick={clearRecent}
                    className="text-[11px] font-semibold text-mute hover:text-ink"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      onClick={() => setQ(r)}
                      className="rounded-full border border-line bg-white px-4 py-1.5 text-sm text-ink hover:border-gold hover:text-gold"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-caps text-gold">
                <Flame size={12} /> Trending now
              </h2>
              <div className="flex flex-wrap gap-2">
                {TRENDING.map((t) => (
                  <button
                    key={t}
                    onClick={() => setQ(t)}
                    className="rounded-full bg-navy px-4 py-1.5 text-sm font-semibold text-white hover:bg-navy/90"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-caps text-mute">
                Browse by category
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((c) => (
                  <Link
                    key={c}
                    to="/products"
                    search={{ category: c } as never}
                    className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink transition hover:border-gold hover:bg-[#fff8e6]"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            </section>
          </div>
        )}

        {hasQuery && (
          <div className="mt-6">
            {query.isLoading && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            )}

            {!query.isLoading && results.length === 0 && (
              <div className="py-16 text-center">
                <p className="font-display text-xl font-bold text-ink">
                  No results for "{q}"
                </p>
                <p className="mt-2 text-sm text-mute">
                  Try a different term or browse all products.
                </p>
                <Link
                  to="/products"
                  className="mt-6 inline-block rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-navy"
                >
                  Browse the Vault
                </Link>
              </div>
            )}

            {results.length > 0 && (
              <>
                <p className="mb-4 text-sm text-mute">
                  {results.length} {results.length === 1 ? "result" : "results"} for{" "}
                  <span className="font-semibold text-ink">"{q}"</span>
                </p>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
                  {results.map((p, i) => (
                    <ProductCard key={p.id} product={p} index={i} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </MarketShell>
  );
}
