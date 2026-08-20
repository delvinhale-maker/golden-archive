import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { getProducts } from "@/lib/marketplace.functions";
import {
  BUSINESS_SYSTEMS_LABEL,
  BUSINESS_SYSTEMS_SLUG,
} from "@/lib/business-systems";

/**
 * Homepage band for the Business Systems department. Renders nothing until at
 * least one live system exists, so the homepage never shows an empty shelf.
 */
export function BusinessSystemsRow() {
  const { data } = useQuery({
    queryKey: ["home-business-systems"],
    queryFn: () =>
      getProducts({
        data: { category: BUSINESS_SYSTEMS_SLUG, pageSize: 6, page: 1 },
      }),
    staleTime: 60_000,
  });
  const products = (data?.items ?? []).slice(0, 6);
  if (!products.length) return null;

  return (
    <section
      aria-labelledby="home-business-systems"
      className="border-y border-white/10 bg-[#080A11]"
    >
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 md:py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-caps text-gold">
              AurumVault
            </div>
            <h2
              id="home-business-systems"
              className="mt-1 font-display text-2xl font-bold text-white md:text-3xl"
            >
              {BUSINESS_SYSTEMS_LABEL}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/65">
              More than templates. Complete systems you can put to work.
            </p>
          </div>
          <Link
            to="/business-systems"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-gold/50 px-5 py-2.5 text-[12px] font-bold uppercase tracking-caps text-gold transition hover:bg-gold hover:text-navy"
          >
            Explore Business Systems <ArrowRight size={14} aria-hidden />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
