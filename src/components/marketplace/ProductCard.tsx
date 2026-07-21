import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, Heart, Star } from "lucide-react";

import { useState } from "react";
import { useCart, useWishlist } from "@/hooks/use-av-store";
import { useOwnsProduct } from "@/hooks/use-owned-products";
import { ProductCover } from "@/components/marketplace/ProductCover";
import { categoryDisplay } from "@/lib/product-types";
import { accentFor } from "@/lib/categories";

import type { Product } from "@/lib/marketplace.functions";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const wishlist = useWishlist();
  const cart = useCart();
  const liked = wishlist.has(product.id);
  const owned = useOwnsProduct(product.id);
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = !imgFailed && !!product.image && /^https?:\/\//.test(product.image);
  const accent = accentFor(product.category);

  return (
    <motion.article
      data-testid="product-tile"
      data-product-id={product.id}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, delay: (index % 8) * 0.04 }}
      whileHover={{ y: -4 }}
      style={{ borderTop: `3px solid ${accent}`, ["--av-accent" as string]: accent }}
      className="av-card av-accent-hover group flex min-w-0 flex-col overflow-hidden border border-[rgba(184,134,11,0.3)]"
    >
      <Link
        to="/products/$id"
        params={{ id: product.id }}
        className="relative block"
      >
        <div className="relative aspect-[2/3] w-full min-h-[280px] md:min-h-[320px] overflow-hidden rounded-md bg-[#F5F0E8] shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          {hasImage ? (
            <img
              src={product.image}
              alt={product.title}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <ProductCover
              title={product.title}
              category={product.category}
              productId={product.id}
              index={index}
              className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.04]"
            />
          )}

          {product.bestseller && (
            <span className="absolute left-3 top-3 rounded-sm bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-navy">
              Bestseller
            </span>
          )}
          <motion.button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              wishlist.toggle(product.id);
            }}
            whileTap={{ scale: 0.85 }}
            animate={liked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 12 }}
            aria-label="Toggle wishlist"
            className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-navy/70 text-white/90 shadow-card backdrop-blur-sm hover:text-gold"
          >
            <Heart
              size={14}
              fill={liked ? "var(--gold)" : "none"}
              stroke={liked ? "var(--gold)" : "currentColor"}
            />
          </motion.button>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {(() => {
          const d = categoryDisplay(product.category);
          return (
            <div
              className="text-[11px] font-semibold uppercase tracking-caps"
              style={{ color: d.accent }}
            >
              {d.label}
            </div>
          );
        })()}
        <Link
          to="/products/$id"
          params={{ id: product.id }}
          className="mt-1 line-clamp-2 min-h-[2.6em] break-words font-display text-[15px] font-bold leading-snug text-ink hover:text-navy"
        >
          {product.title}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-mute">
          <span>{product.creator.name}</span>
        </div>

        {product.reviewCount > 0 && (
          <div
            className="mt-2 flex items-center gap-1.5 text-[12px] text-mute"
            aria-label={`Rated ${product.rating.toFixed(1)} out of 5 from ${product.reviewCount} review${product.reviewCount === 1 ? "" : "s"}`}
          >
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  fill={i < Math.round(product.rating) ? "var(--gold)" : "none"}
                  stroke="var(--gold)"
                />
              ))}
            </div>
            <span className="tabular-nums">{product.rating.toFixed(1)}</span>
            <span>({product.reviewCount})</span>
          </div>
        )}
        <div className="mt-3 flex items-baseline gap-2">
          <span
            data-testid="product-price"
            className="font-display text-[18px] font-bold text-gold-ink"
          >
            ${product.price.toFixed(2)}
          </span>
          {product.compareAtPrice && (
            <span
              data-testid="product-compare-at"
              className="text-[12px] text-mute line-through"
            >
              ${product.compareAtPrice.toFixed(2)}
            </span>
          )}
        </div>
        {owned ? (
          <Link
            to="/library"
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border-2 border-gold bg-navy py-2.5 text-[13px] font-bold text-gold hover:bg-navy/90"
            aria-label={`You own ${product.title} — open your library`}
          >
            <BookOpen size={14} />
            Owned · Open Library
          </Link>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() =>
              cart.add({
                id: product.id,
                title: product.title,
                price: product.price,
                category: product.category,
                image: product.image,
              })
            }
            className="mt-4 w-full rounded-full bg-gold py-2.5 text-[13px] font-bold text-navy hover:shadow-gold-glow"
          >
            {cart.has(product.id) ? "✓ In Cart" : "Add to Cart"}
          </motion.button>
        )}
      </div>
    </motion.article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="av-card overflow-hidden">
      <div className="h-[200px] av-skeleton" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-16 rounded av-skeleton" />
        <div className="h-4 w-3/4 rounded av-skeleton" />
        <div className="h-3 w-1/2 rounded av-skeleton" />
        <div className="h-9 w-full rounded-full av-skeleton" />
      </div>
    </div>
  );
}
