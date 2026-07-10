import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ProductCard } from "./ProductCard";
import { getNewReleasesRowFn, type Product } from "@/lib/marketplace.functions";

export const newReleasesRowQ = queryOptions({
  queryKey: ["mp", "row", "new-releases"],
  queryFn: () => getNewReleasesRowFn(),
});

export function NewReleasesRow() {
  const { data } = useSuspenseQuery(newReleasesRowQ);
  const products = data as Product[];
  if (products.length === 0) return null;
  return (
    <section className="bg-bg-page py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <span
            className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{
              color: "var(--accent-amber)",
              borderColor: "color-mix(in oklab, var(--accent-amber) 55%, transparent)",
              backgroundColor: "color-mix(in oklab, var(--accent-amber) 12%, transparent)",
            }}
          >
            Just Dropped
          </span>
          <h2
            className="mt-3 font-display text-3xl font-bold md:text-4xl"
            style={{ color: "#ffffff" }}
          >
            Just Dropped
          </h2>
          <span
            className="mt-3 block h-[2px] w-10"
            style={{ background: "var(--accent-amber)" }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {products.slice(0, 8).map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
