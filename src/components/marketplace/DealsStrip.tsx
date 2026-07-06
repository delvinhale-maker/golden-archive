import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { ProductCover } from "./ProductCover";
import {
  AffiliateBookPlaceholder,
  isPlaceholderImage,
} from "./AffiliateBookPlaceholder";
import type { Product } from "@/lib/marketplace.functions";

import type { AffiliateProduct } from "@/lib/affiliate";
import { logAffiliateClick } from "@/lib/affiliate";

const MAX_CARDS = 6;

function endOfDayMs() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function useCountdown(target: number) {
  const now = useNow(1000);
  const diff = now === null ? 0 : Math.max(0, target - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { h, m, s, ready: now !== null };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function pctDiscount(price: number, original: number | null | undefined) {
  if (!original || original <= price) return null;
  return Math.round((1 - price / original) * 100);
}

type OwnDeal = {
  kind: "own";
  key: string;
  product: Product;
  discount: number;
};

type AmazonDeal = {
  kind: "amazon";
  key: string;
  product: AffiliateProduct;
  discount: number;
};

type Deal = OwnDeal | AmazonDeal;

export function DealsStrip({
  products,
  amazonDeals = [],
}: {
  products: Product[];
  amazonDeals?: AffiliateProduct[];
}) {
  const [target] = useState(() => endOfDayMs());
  const { h, m, s, ready } = useCountdown(target);

  const ownDeals: OwnDeal[] = products
    .map((p) => {
      const d = pctDiscount(p.price, p.compareAtPrice ?? null);
      return d != null ? { kind: "own" as const, key: `own-${p.id}`, product: p, discount: d } : null;
    })
    .filter((d): d is OwnDeal => d !== null);

  const amazon: AmazonDeal[] = amazonDeals
    .map((p) => {
      const d = pctDiscount(Number(p.price), p.original_price != null ? Number(p.original_price) : null);
      return d != null ? { kind: "amazon" as const, key: `az-${p.id}`, product: p, discount: d } : null;
    })
    .filter((d): d is AmazonDeal => d !== null);

  const deals: Deal[] = [...ownDeals, ...amazon].slice(0, MAX_CARDS);
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

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {deals.map((deal, i) => (
            <motion.div
              key={deal.key}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              {deal.kind === "own" ? (
                <OwnDealCard deal={deal} />
              ) : (
                <AmazonDealCard deal={deal} />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SourceBadge({ kind }: { kind: "own" | "amazon" }) {
  if (kind === "own") {
    return (
      <span className="absolute left-2 top-2 rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
        AurumVault
      </span>
    );
  }
  return (
    <span className="absolute left-2 top-2 rounded-full bg-[#ff9900] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy">
      Amazon
    </span>
  );
}

function DiscountBadge({ pct }: { pct: number }) {
  return (
    <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
      -{pct}% OFF
    </span>
  );
}

function OwnDealCard({ deal }: { deal: OwnDeal }) {
  const p = deal.product;
  return (
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
        <SourceBadge kind="own" />
        <DiscountBadge pct={deal.discount} />
      </div>
      <div className="p-4">
        <div className="text-[10px] font-semibold tracking-caps text-gold">
          {p.category.toUpperCase()}
        </div>
        <div className="mt-1 line-clamp-2 font-display text-sm font-bold text-ink">
          {p.title}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-lg font-bold text-gold">
            ${p.price.toFixed(2)}
          </span>
          <span className="text-xs text-mute line-through">
            ${p.compareAtPrice?.toFixed(2)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function AmazonDealCard({ deal }: { deal: AmazonDeal }) {
  const p = deal.product;
  const price = Number(p.price);
  const original = p.original_price != null ? Number(p.original_price) : null;
  const expiresMs = p.deal_expires_at ? new Date(p.deal_expires_at).getTime() : endOfDayMs();
  const { h, m, s, ready } = useCountdown(expiresMs);

  return (
    <article className="av-card group flex h-full flex-col overflow-hidden border border-transparent transition hover:-translate-y-1 hover:border-gold hover:shadow-card-hover">
      <div className="relative aspect-[1.6/1] bg-[#f5f4ef]">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
        <SourceBadge kind="amazon" />
        <DiscountBadge pct={deal.discount} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="text-[10px] font-semibold tracking-caps text-gold">
          {p.category.toUpperCase()}
        </div>
        <div className="mt-1 line-clamp-2 font-display text-sm font-bold text-ink">
          {p.title}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-lg font-bold text-gold">
            ${price.toFixed(2)}
          </span>
          {original != null && (
            <span className="text-xs text-mute line-through">
              ${original.toFixed(2)}
            </span>
          )}
        </div>
        <div
          className="mt-2 flex items-center gap-1 font-mono text-[11px] font-bold text-navy"
          aria-label="Deal countdown"
        >
          <TimeBox v={ready ? pad(h) : "--"} small />
          <span>:</span>
          <TimeBox v={ready ? pad(m) : "--"} small />
          <span>:</span>
          <TimeBox v={ready ? pad(s) : "--"} small />
        </div>
        <a
          href={p.affiliate_url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => logAffiliateClick(p)}
          onAuxClick={() => logAffiliateClick(p)}
          className="mt-3 inline-flex h-10 items-center justify-center gap-1 rounded-full bg-gold px-4 text-xs font-bold text-navy transition hover:brightness-105"
        >
          Shop on Amazon <ExternalLink size={12} />
        </a>
        <span className="mt-2 text-center text-[10px] italic text-mute">Sponsored</span>
      </div>
    </article>
  );
}

function TimeBox({ v, small = false }: { v: string; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md bg-navy px-1.5 text-white ${
        small ? "h-6 min-w-[24px] text-[11px]" : "h-7 min-w-[28px]"
      }`}
    >
      {v}
    </span>
  );
}
