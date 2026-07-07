import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { ProductCover } from "./ProductCover";
import type { Product } from "@/lib/marketplace.functions";

export function BestsellersRow({ products }: { products: Product[] }) {
  const items = products.slice(0, 8);
  if (!items.length) return null;

  return (
    <section className="bg-bg-page py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-caps text-gold-ink">
              <Trophy size={14} /> BESTSELLING TITLES
            </div>
            <h2 className="mt-1 font-display text-3xl font-bold text-white md:text-4xl">
              Bestselling Titles
            </h2>
          </div>
          <Link
            to="/products"
            className="hidden text-sm font-bold text-gold-ink underline-offset-4 hover:underline md:inline"
          >
            See all →
          </Link>
        </div>

        <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-3 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0">
          {items.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="min-w-[200px] md:min-w-0"
            >
              <Link
                to="/products/$id"
                params={{ id: p.id }}
                className="av-card group block overflow-hidden border border-transparent transition hover:-translate-y-1 hover:border-gold hover:shadow-card-hover"
              >
                <div className="relative aspect-[1.6/1] bg-[#f5f4ef]">
                  <ProductCover
                    title={p.title}
                    category={p.category}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold text-gold-ink">
                    #{i + 1}
                  </span>
                </div>
                <div className="p-3">
                  <div className="text-[10px] font-semibold tracking-caps text-gold-ink">
                    {p.category.toUpperCase()}
                  </div>
                  <div className="mt-1 line-clamp-2 font-display text-sm font-bold text-ink">
                    {p.title}
                  </div>
                  <div className="mt-2 font-display text-base font-bold text-gold-ink">
                    ${p.price.toFixed(2)}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
