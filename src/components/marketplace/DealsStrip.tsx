import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { motion } from "framer-motion";
import { ProductCover } from "./ProductCover";
import type { Product } from "@/lib/marketplace.functions";

function endOfDayMs() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function useCountdown(target: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = now === null ? 0 : Math.max(0, target - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { h, m, s, ready: now !== null };
}


function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function pctDiscount(p: Product) {
  if (!p.compareAtPrice || p.compareAtPrice <= p.price) return null;
  return Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100);
}

export function DealsStrip({ products }: { products: Product[] }) {
  const [target] = useState(() => endOfDayMs());
  const { h, m, s, ready } = useCountdown(target);

  const deals = products
    .map((p) => ({ product: p, discount: pctDiscount(p) }))
    .filter((d): d is { product: Product; discount: number } => d.discount !== null)
    .slice(0, 4);

  if (!deals.length) return null;

  return (
    <section className="bg-bg-page py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-caps text-gold">
              <Flame size={14} /> DEALS OF THE DAY
            </div>
            <h2 className="mt-1 font-display text-3xl font-bold text-white md:text-4xl">
              Today's gold picks
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-white/70">Ends in</span>
            <div className="flex items-center gap-1 font-mono text-sm font-bold text-navy">
              <TimeBox v={ready ? pad(h) : "--"} />
              <span>:</span>
              <TimeBox v={ready ? pad(m) : "--"} />
              <span>:</span>
              <TimeBox v={ready ? pad(s) : "--"} />

            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {deals.map(({ product, discount }, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Link
                to="/products/$id"
                params={{ id: product.id }}
                className="av-card group block overflow-hidden border border-transparent transition hover:-translate-y-1 hover:border-gold hover:shadow-card-hover"
              >
                <div className="relative aspect-[1.6/1] bg-[#f5f4ef]">
                  <ProductCover
                    title={product.title}
                    category={product.category}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-navy">
                    -{discount}%
                  </span>
                </div>
                <div className="p-4">
                  <div className="text-[10px] font-semibold tracking-caps text-gold">
                    {product.category.toUpperCase()}
                  </div>
                  <div className="mt-1 line-clamp-2 font-display text-sm font-bold text-ink">
                    {product.title}
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-lg font-bold text-gold">
                      ${product.price.toFixed(2)}
                    </span>
                    <span className="text-xs text-mute line-through">
                      ${product.compareAtPrice?.toFixed(2)}
                    </span>
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

function TimeBox({ v }: { v: string }) {
  return (
    <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md bg-navy px-1.5 text-white">
      {v}
    </span>
  );
}
