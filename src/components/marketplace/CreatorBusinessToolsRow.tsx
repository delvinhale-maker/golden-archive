import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { getProducts } from "@/lib/marketplace.functions";
import {
  CREATOR_TOOLS_LABEL,
  CREATOR_TOOLS_SLUG,
} from "@/lib/creator-business-tools";

/**
 * Homepage band for the Creator Business Tools department. Renders nothing
 * until at least one live tool exists, so the homepage never shows an empty
 * shelf.
 */
export function CreatorBusinessToolsRow() {
  const { data } = useQuery({
    queryKey: ["home-creator-business-tools"],
    queryFn: () =>
      getProducts({
        data: { category: CREATOR_TOOLS_SLUG, pageSize: 6, page: 1 },
      }),
    staleTime: 60_000,
  });
  const products = (data?.items ?? []).slice(0, 6);
  if (!products.length) return null;

  return (
    <section
      aria-labelledby="home-creator-business-tools"
      className="border-y border-white/10 bg-[#0A0D17]"
    >
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 md:py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-caps text-gold">
              AurumVault
            </div>
            <h2
              id="home-creator-business-tools"
              className="mt-1 font-display text-2xl font-bold text-white md:text-3xl"
            >
              {CREATOR_TOOLS_LABEL}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/65">
              Professional systems for creators who are ready to turn content
              into business.
            </p>
          </div>
          <Link
            to="/creator-business-tools"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-gold/50 px-5 py-2.5 text-[12px] font-bold uppercase tracking-caps text-gold transition hover:bg-gold hover:text-navy"
          >
            Explore Creator Business Tools <ArrowRight size={14} aria-hidden />
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
