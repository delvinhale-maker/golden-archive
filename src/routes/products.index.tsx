import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Filter, SlidersHorizontal, Star, X } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { MarketShell } from "@/components/marketplace/MarketShell";
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/marketplace/ProductCard";
import { getProducts, type Product } from "@/lib/marketplace.functions";
import { CategoryHero } from "@/components/marketplace/CategoryHero";
import { getCategoryTheme } from "@/lib/category-theme";
import { CATEGORIES as CATEGORY_DEFS } from "@/lib/categories";

const searchSchema = z.object({
  category: z.string().optional(),
  sort: z.string().optional(),
  q: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  rating: z.number().optional(),
  sub: z.string().optional(),
});

const CATEGORIES = CATEGORY_DEFS.map((c) => c.label);

const SORTS = [
  { v: "featured", l: "Featured" },
  { v: "newest", l: "Newest" },
  { v: "price-asc", l: "Price: Low to High" },
  { v: "price-desc", l: "Price: High to Low" },
  { v: "rating", l: "Top Rated" },
];

export const Route = createFileRoute("/products/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Browse the Vault | AurumVault — Gold Standard Digital Commerce" },
      {
        name: "description",
        content:
          "Filter and discover purpose-driven eBooks, courses, templates, and tools from verified creators.",
      },
      { property: "og:title", content: "Browse the Vault | AurumVault" },
      {
        property: "og:description",
        content:
          "Filter and discover purpose-driven digital products from verified creators.",
      },
      { property: "og:url", content: "https://www.aurumvault.store/products" },
      { name: "twitter:title", content: "Browse the Vault | AurumVault" },
      {
        name: "twitter:description",
        content:
          "Filter and discover purpose-driven digital products from verified creators.",
      },
    ],
    links: [{ rel: "canonical", href: "https://www.aurumvault.store/products" }],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const query = useQuery({
    queryKey: ["mp", "products", search],
    queryFn: () =>
      getProducts({
        data: {
          category: search.category,
          sort: search.sort,
          q: search.q,
          page: 1,
        },
      }),
    placeholderData: keepPreviousData,
  });

  const raw = (query.data?.items ?? []) as Product[];
  const products = applyClientFilters(raw, search);
  const theme = getCategoryTheme(search.category);

  const updateSearch = (patch: Record<string, unknown>) => {
    navigate({
      to: "/products",
      search: { ...search, ...patch } as never,
      replace: true,
    });
  };

  const clearAll = () =>
    navigate({ to: "/products", search: {} as never, replace: true });

  return (
    <MarketShell>
      <CategoryHero
        category={search.category}
        query={search.q}
        resultCount={products.length}
        products={products}
        activeSub={search.sub ?? null}
        onSubChange={(sub) => updateSearch({ sub: sub ?? undefined })}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-ink">
              {search.category ? `${search.category} titles` : "All products"}
            </h2>
            {search.q && (
              <p className="mt-1 text-sm text-mute">
                Results for <span className="font-semibold text-ink">"{search.q}"</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink md:hidden"
            >
              <SlidersHorizontal size={14} /> Filters
            </button>
            <select
              value={search.sort ?? "featured"}
              onChange={(e) => updateSearch({ sort: e.target.value })}
              className="h-10 rounded-full border bg-white px-4 text-sm font-semibold text-ink focus:outline-none focus:ring-2"
              style={{ borderColor: theme.border, boxShadow: `0 0 0 0 ${theme.accent}` }}
            >
              {SORTS.map((s) => (
                <option key={s.v} value={s.v}>
                  Sort: {s.l}
                </option>
              ))}
            </select>
          </div>
        </div>


        <div className="grid gap-8 md:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <aside className="hidden md:block">
            <SidebarFilters
              search={search}
              onUpdate={updateSearch}
              onClear={clearAll}
            />
          </aside>

          <div>
            <p className="mb-4 text-sm text-mute">
              {query.isFetching && !query.data ? "Loading..." : `${products.length} results`}
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
              {query.isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                  ))
                : products.map((p, i) => (
                    <ProductCard key={p.id} product={p} index={i} />
                  ))}
            </div>

            {!query.isLoading && products.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Crown size={40} className="text-gold-ink" />
                <h3 className="mt-4 font-display text-2xl font-bold text-ink">
                  No products found
                </h3>
                <p className="mt-1 text-sm text-mute">Try adjusting your filters.</p>
                <button
                  onClick={clearAll}
                  className="mt-6 rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-navy"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 md:hidden"
            onClick={() => setDrawerOpen(false)}
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="h-full w-[85%] max-w-sm overflow-y-auto bg-white p-5"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2 font-display text-xl font-bold text-ink">
                  <Filter size={18} /> Filters
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close"
                  className="h-10 w-10 rounded-full hover:bg-muted"
                >
                  <X className="mx-auto" size={18} />
                </button>
              </div>
              <SidebarFilters
                search={search}
                onUpdate={(p) => {
                  updateSearch(p);
                }}
                onClear={() => {
                  clearAll();
                  setDrawerOpen(false);
                }}
              />
              <button
                onClick={() => setDrawerOpen(false)}
                className="mt-6 w-full rounded-full bg-gold py-3 text-sm font-bold text-navy"
              >
                Apply Filters
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MarketShell>
  );
}

function SidebarFilters({
  search,
  onUpdate,
  onClear,
}: {
  search: z.infer<typeof searchSchema>;
  onUpdate: (p: Record<string, unknown>) => void;
  onClear: () => void;
}) {
  const maxPrice = search.maxPrice ?? 250;
  const rating = search.rating ?? 0;
  return (
    <div className="space-y-7 rounded-lg border border-line bg-white p-5">
      <FilterBlock title="Price Range">
        <input
          type="range"
          min={0}
          max={500}
          step={5}
          value={maxPrice}
          onChange={(e) => onUpdate({ maxPrice: Number(e.target.value) })}
          className="av-range w-full accent-[var(--gold)]"
        />
        <div className="mt-2 flex justify-between text-xs text-mute">
          <span>$0</span>
          <span className="font-semibold text-ink">Up to ${maxPrice}</span>
        </div>
      </FilterBlock>

      <FilterBlock title="Category">
        <div className="space-y-2">
          {CATEGORIES.map((c) => {
            const checked = search.category === c;
            return (
              <label
                key={c}
                className="flex cursor-pointer items-center gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--gold)]"
                  checked={checked}
                  onChange={() =>
                    onUpdate({ category: checked ? undefined : c })
                  }
                />
                {c}
              </label>
            );
          })}
        </div>
      </FilterBlock>

      <FilterBlock title="Minimum Rating">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onUpdate({ rating: rating === r ? undefined : r })}
            >
              <Star
                size={20}
                fill={r <= rating ? "var(--gold)" : "none"}
                stroke="var(--gold)"
              />
            </button>
          ))}
        </div>
      </FilterBlock>

      <button
        onClick={onClear}
        className="text-sm font-semibold text-gold-ink hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-[11px] font-bold uppercase tracking-caps text-mute">
        {title}
      </div>
      {children}
    </div>
  );
}

function applyClientFilters(
  items: Product[],
  s: z.infer<typeof searchSchema>,
): Product[] {
  let out = items.slice();
  if (typeof s.maxPrice === "number") out = out.filter((p) => p.price <= s.maxPrice!);
  if (typeof s.minPrice === "number") out = out.filter((p) => p.price >= s.minPrice!);
  if (typeof s.rating === "number" && s.rating > 0) {
    out = out.filter((p) => (p.rating ?? 0) >= s.rating!);
  }
  if (s.sub) {
    const needle = s.sub.toLowerCase();
    out = out.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        (p.description ?? "").toLowerCase().includes(needle),
    );
  }
  switch (s.sort) {
    case "price-asc":
      out.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      out.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case "newest":
      // server already returns newest-first
      break;
  }
  return out;
}
