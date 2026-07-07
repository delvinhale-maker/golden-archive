import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ProductCard } from "./ProductCard";
import { getPromotedPicksRowFn, type Product } from "@/lib/marketplace.functions";

export const promotedPicksRowQ = queryOptions({
  queryKey: ["mp", "row", "promoted-picks"],
  queryFn: () => getPromotedPicksRowFn(),
});

export function PromotedPicksRow() {
  const { data } = useSuspenseQuery(promotedPicksRowQ);
  const products = data as Product[];
  if (products.length === 0) return null;
  return (
    <section className="bg-bg-page py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="text-[11px] font-semibold tracking-caps text-gold">
            SPONSORED — AURUMVAULT
          </div>
          <h2 className="mt-2 font-display text-3xl font-bold text-navy md:text-4xl">
            Promoted Picks
          </h2>

          <span className="mt-3 block h-[2px] w-10 bg-gold" />
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
