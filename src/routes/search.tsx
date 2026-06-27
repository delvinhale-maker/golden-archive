import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search as SearchIcon, X } from "lucide-react";
import { z } from "zod";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ProductCard, ProductCardSkeleton } from "@/components/marketplace/ProductCard";
import { getProducts } from "@/lib/marketplace.functions";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export const Route = createFileRoute("/search")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({ meta: [{ title: "Search — AurumVault" }] }),
  component: SearchPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback error={error} reset={reset} title="Search isn't loading" />
  ),
});


function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState(search.q ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce URL sync
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

  const results = query.data?.items ?? [];
  const hasQuery = q.trim().length > 0;

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

        <div className="mt-6">
          {!hasQuery && (
            <p className="py-16 text-center text-sm text-mute">
              Start typing to search the vault.
            </p>
          )}

          {hasQuery && query.isLoading && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          )}

          {hasQuery && !query.isLoading && results.length === 0 && (
            <div className="py-16 text-center">
              <p className="font-display text-xl font-bold text-ink">
                No results found
              </p>
              <p className="mt-2 text-sm text-mute">
                Try a different search term or browse all products.
              </p>
            </div>
          )}

          {hasQuery && results.length > 0 && (
            <>
              <p className="mb-4 text-sm text-mute">
                {results.length} {results.length === 1 ? "result" : "results"}
              </p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
                {results.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </MarketShell>
  );
}
