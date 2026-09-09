import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ProductCard } from "@/components/marketplace/ProductCard";
import type { Product } from "@/lib/marketplace.functions";
import type { CommercialCategoryPageConfig } from "@/lib/commercial-category-pages";

export function CommercialCategoryLanding({
  config,
  products,
}: {
  config: CommercialCategoryPageConfig;
  products: Product[];
}) {
  return (
    <MarketShell>
      <main className="bg-[#080A11] text-white">
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
            <p className="text-xs font-bold uppercase tracking-caps text-gold">
              {config.eyebrow}
            </p>
            <h1 className="mt-3 max-w-4xl font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              {config.h1}
            </h1>
            <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-white/75 md:text-base">
              {config.intro}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="#category-products"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-navy"
              >
                Browse {config.label} <ArrowRight size={15} aria-hidden />
              </a>
              <Link
                to="/products"
                search={{ category: config.label } as never}
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white"
              >
                Browse all digital products
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 bg-[#0B0E16]">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-12">
            <h2 className="font-display text-2xl font-bold">Choose for the workflow, not just the cover</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/70">{config.why}</p>
            {config.note && (
              <p className="mt-4 rounded-xl border border-gold/20 bg-gold/5 p-4 text-sm leading-relaxed text-white/65">
                {config.note}
              </p>
            )}
          </div>
        </section>

        <section id="category-products" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-caps text-gold">AurumVault marketplace</p>
              <h2 className="mt-1 font-display text-2xl font-bold">Available {config.label}</h2>
            </div>
            <Link to="/academy" className="text-sm font-bold text-gold hover:underline">
              Explore related Academy guidance
            </Link>
          </div>

          {products.length > 0 ? (
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
              <p className="font-semibold">No published {config.label.toLowerCase()} are available right now.</p>
              <p className="mt-2 text-sm text-white/60">
                Browse the full catalog or check back as creators publish new resources.
              </p>
            </div>
          )}
        </section>
      </main>
    </MarketShell>
  );
}
