import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ProductCover } from "./ProductCover";
import { getProducts, type Product } from "@/lib/marketplace.functions";

export function CustomersAlsoBought({
  category,
  excludeId,
}: {
  category: string;
  excludeId: string;
}) {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    let active = true;
    getProducts({ data: { category, page: 1 } })
      .then((res) => {
        if (!active) return;
        setItems(res.items.filter((p) => p.id !== excludeId).slice(0, 4));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [category, excludeId]);

  if (!items.length) return null;

  return (
    <section className="border-t border-line bg-[#f9fafb] py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="mb-6 font-display text-2xl font-bold text-ink md:text-3xl">
          Customers also bought
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {items.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Link
                to="/products/$id"
                params={{ id: p.id }}
                className="av-card group block overflow-hidden border border-transparent transition hover:-translate-y-1 hover:border-gold hover:shadow-card-hover"
              >
                <div className="aspect-[1.6/1] bg-[#f5f4ef]">
                  <ProductCover
                    title={p.title}
                    category={p.category}
                    className="h-full w-full object-cover"
                  />
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
