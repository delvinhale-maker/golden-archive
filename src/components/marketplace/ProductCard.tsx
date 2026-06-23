import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BadgeCheck, Heart, Star } from "lucide-react";
import { useWishlist } from "@/hooks/use-av-store";
import { ProductCover } from "@/components/marketplace/ProductCover";
import type { Product } from "@/lib/marketplace.functions";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const wishlist = useWishlist();
  const liked = wishlist.has(product.id);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, delay: (index % 8) * 0.04 }}
      whileHover={{ y: -4 }}
      className="av-card group flex min-w-0 flex-col overflow-hidden"
    >
      <Link
        to="/products/$id"
        params={{ id: product.id }}
        className="relative block"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f5f4ef]">
          <ProductCover
            title={product.title}
            category={product.category}
            productId={product.id}
            index={index}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
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
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-mute shadow-card hover:text-gold"
          >
            <Heart
              size={16}
              fill={liked ? "var(--gold)" : "none"}
              stroke={liked ? "var(--gold)" : "currentColor"}
            />
          </motion.button>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="text-[11px] font-semibold uppercase tracking-caps text-gold">
          {product.category}
        </div>
        <Link
          to="/products/$id"
          params={{ id: product.id }}
          className="mt-1 line-clamp-2 min-h-[2.6em] break-words font-display text-[15px] font-bold leading-snug text-ink hover:text-navy"
        >
          {product.title}
        </Link>
        <div className="mt-1.5 flex items-center gap-1 text-[12px] text-mute">
          <span>{product.creator.name}</span>
          {product.creator.verified && (
            <BadgeCheck size={13} className="text-emerald" />
          )}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-mute">
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
          <span>({product.reviewCount})</span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-[18px] font-bold text-gold">
            ${product.price}
          </span>
          {product.compareAtPrice && (
            <span className="text-[12px] text-mute line-through">
              ${product.compareAtPrice}
            </span>
          )}
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="mt-4 w-full rounded-full bg-gold py-2.5 text-[13px] font-bold text-navy hover:shadow-gold-glow"
        >
          Buy Now
        </motion.button>
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
