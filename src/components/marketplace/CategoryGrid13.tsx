import { Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CATEGORIES } from "@/lib/categories";
import { getCategoryCounts } from "@/lib/creators.functions";

export const categoryCountsQ = queryOptions({
  queryKey: ["mp", "category-counts"],
  queryFn: () => getCategoryCounts(),
  staleTime: 5 * 60_000,
});

export function CategoryGrid13() {
  const { data } = useSuspenseQuery(categoryCountsQ);
  const counts = (data ?? {}) as Record<string, number>;
  return (
    <section id="categories" className="bg-bg-page py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="text-[11px] font-semibold tracking-caps text-gold">
            ALL CATEGORIES
          </div>
          <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">
            Browse the full vault
          </h2>
          <span className="mt-3 block h-[2px] w-10 bg-gold" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {CATEGORIES.map((c) => {
            const count = counts[c.slug] ?? 0;
            return (
              <Link
                key={c.slug}
                to="/products"
                search={{ category: c.slug } as never}
                className="group flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-center transition hover:-translate-y-1 hover:border-gold hover:bg-white/10"
                style={{ minHeight: 130 }}
              >
                <div
                  className="grid h-12 w-12 place-items-center rounded-full text-2xl transition-transform group-hover:scale-110"
                  style={{ background: c.gradient }}
                >
                  <span aria-hidden>{c.icon}</span>
                </div>
                <span className="text-[13px] font-bold leading-tight text-white">
                  {c.label}
                </span>
                <span className="text-[11px] text-white/50">
                  {count} product{count === 1 ? "" : "s"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
