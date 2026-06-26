import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgeCheck,
  Check,
  Download,
  Heart,
  Lock,
  Share2,
  Star,
  X,
} from "lucide-react";
import { useState } from "react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ProductCover } from "@/components/marketplace/ProductCover";
import { StripeEmbeddedProductCheckout } from "@/components/StripeEmbeddedCheckout";
import { useWishlist } from "@/hooks/use-av-store";
import { getProduct, type Product } from "@/lib/marketplace.functions";

const productQ = (id: string) =>
  queryOptions({
    queryKey: ["mp", "product", id],
    queryFn: () => getProduct({ data: { id } }),
  });

export const Route = createFileRoute("/products/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(productQ(params.id)),
  head: ({ params }) => ({
    meta: [
      { title: `Product · AurumVault` },
      {
        name: "description",
        content:
          "A premium digital resource from a verified AurumVault creator.",
      },
      { property: "og:title", content: "Product · AurumVault" },
      {
        property: "og:description",
        content: "A premium digital resource from a verified AurumVault creator.",
      },
    ],
    links: [{ rel: "canonical", href: `/products/${params.id}` }],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data: product } = useSuspenseQuery(productQ(id)) as { data: Product };
  const wishlist = useWishlist();
  const liked = wishlist.has(product.id);
  const [active, setActive] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  void active;

  return (
    <MarketShell>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 md:px-8">
        <nav className="mb-6 text-xs text-mute">
          <Link to="/" className="hover:text-ink">Home</Link>
          <span className="px-1.5">/</span>
          <Link
            to="/products"
            search={{ category: product.category } as never}
            className="hover:text-ink"
          >
            {product.category}
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-ink">{product.title}</span>
        </nav>

        <div className="grid gap-10 md:grid-cols-[55%_45%]">
          {/* Gallery */}
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="relative flex h-[360px] w-full items-center justify-center overflow-hidden rounded-xl bg-[#f5f4ef] md:h-[460px]"
            >
              <ProductCover
                title={product.title}
                category={product.category}
                productId={product.id}
                className="h-full w-full object-cover"
              />
              {product.bestseller && (
                <span className="absolute left-4 top-4 rounded-sm bg-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-caps text-navy">
                  Bestseller
                </span>
              )}
            </motion.div>
            <div className="mt-3 flex gap-2">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`h-16 w-16 overflow-hidden rounded-md border-2 ${
                    active === i ? "border-gold" : "border-line"
                  }`}
                >
                  <ProductCover
                    title={product.title + (i ? ` · ${i}` : "")}
                    category={product.category}
                    productId={product.id + ":" + i}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="text-[11px] font-semibold tracking-caps text-gold">
              {product.category.toUpperCase()}
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-ink md:text-4xl">
              {product.title}
            </h1>

            <div className="mt-4 flex items-center gap-3">
              {product.creator.avatar && (
                <img
                  src={product.creator.avatar}
                  alt={product.creator.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              )}
              <div className="flex items-center gap-1 text-sm font-semibold text-ink">
                {product.creator.name}
                {product.creator.verified && (
                  <BadgeCheck size={14} className="text-emerald" />
                )}
              </div>
              <button className="text-sm font-semibold text-gold hover:underline">
                View Store →
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 text-sm text-mute">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    fill={i < Math.round(product.rating) ? "var(--gold)" : "none"}
                    stroke="var(--gold)"
                  />
                ))}
              </div>
              <span className="font-semibold text-ink">{product.rating.toFixed(1)}</span>
              <span>({product.reviewCount} reviews)</span>
            </div>

            <div className="mt-5 flex items-baseline gap-3">
              <span className="font-display text-3xl font-bold text-gold">
                ${product.price}
              </span>
              {product.compareAtPrice && (
                <span className="text-base text-mute line-through">
                  ${product.compareAtPrice}
                </span>
              )}
            </div>

            <p className="mt-5 text-[15px] leading-relaxed text-mute">
              {product.description}
            </p>

            <motion.button
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.01 }}
              onClick={() => setCheckoutOpen(true)}
              className="mt-6 flex h-[52px] w-full items-center justify-center rounded-full bg-gold text-base font-bold text-navy shadow-gold-glow"
            >
              Buy Now · ${product.price}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => wishlist.toggle(product.id)}
              className={`mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 text-sm font-bold ${
                liked
                  ? "border-gold bg-[var(--accent)] text-navy"
                  : "border-gold text-gold hover:bg-[var(--accent)]"
              }`}
            >
              <Heart
                size={16}
                fill={liked ? "var(--gold)" : "none"}
                stroke="currentColor"
              />
              {liked ? "Saved to Wishlist" : "Add to Wishlist"}
            </motion.button>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-mute">
              <Lock size={12} /> Secure checkout · Instant delivery
            </div>

            {/* What's included */}
            {product.included && (
              <div className="mt-8 rounded-lg border border-line bg-white p-5">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-caps text-mute">
                  What's included
                </div>
                <ul className="space-y-2 text-sm text-ink">
                  {product.included.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check size={16} className="mt-0.5 text-gold" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Creator card */}
            <div className="mt-5 flex items-start gap-4 rounded-lg bg-[#f9fafb] p-5">
              {product.creator.avatar && (
                <img
                  src={product.creator.avatar}
                  alt={product.creator.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-1 text-sm font-bold text-ink">
                  {product.creator.name}
                  {product.creator.verified && (
                    <BadgeCheck size={14} className="text-emerald" />
                  )}
                </div>
                <p className="mt-1 text-xs text-mute">
                  Verified creator on AurumVault. Building purpose-driven
                  resources for operators and leaders.
                </p>
                <button className="mt-2 text-xs font-semibold text-gold hover:underline">
                  Visit store →
                </button>
              </div>
              <button
                aria-label="Share"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-mute hover:text-ink"
              >
                <Share2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
            Reviews
          </h2>
          <div className="mt-6 grid gap-8 md:grid-cols-[300px_1fr]">
            <div className="rounded-lg border border-line bg-white p-6">
              <div className="font-display text-5xl font-bold text-ink">
                {product.rating.toFixed(1)}
              </div>
              <div className="mt-2 flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    fill={i < Math.round(product.rating) ? "var(--gold)" : "none"}
                    stroke="var(--gold)"
                  />
                ))}
              </div>
              <div className="mt-1 text-xs text-mute">
                {product.reviewCount} verified reviews
              </div>
              <div className="mt-5 space-y-1.5">
                {[5, 4, 3, 2, 1].map((s) => (
                  <div key={s} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-mute">{s}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gold"
                        style={{ width: `${[68, 22, 6, 3, 1][5 - s]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-5">
              {MOCK_REVIEWS.map((r, i) => (
                <div key={i} className="rounded-lg border border-line bg-white p-5">
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://i.pravatar.cc/64?img=${20 + i}`}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-sm font-bold text-ink">{r.name}</div>
                      <div className="flex items-center gap-2 text-xs text-mute">
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star
                              key={j}
                              size={11}
                              fill={j < r.stars ? "var(--gold)" : "none"}
                              stroke="var(--gold)"
                            />
                          ))}
                        </div>
                        <span>{r.date}</span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {checkoutOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setCheckoutOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="relative my-6 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setCheckoutOpen(false)}
                aria-label="Close checkout"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow hover:bg-white"
              >
                <X size={18} />
              </button>
              <div className="p-2">
                <StripeEmbeddedProductCheckout productId={product.id} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MarketShell>
  );
}

const MOCK_REVIEWS = [
  {
    name: "Reuben A.",
    stars: 5,
    date: "Mar 12, 2025",
    text:
      "Easily the most thoughtfully designed resource I've bought this year. Worth every penny — the audio companion is exceptional.",
  },
  {
    name: "Imani C.",
    stars: 5,
    date: "Feb 28, 2025",
    text:
      "I share this with every operator on my team. The frameworks are practical and the design is on another level.",
  },
  {
    name: "Daniel R.",
    stars: 4,
    date: "Feb 04, 2025",
    text:
      "Solid content and beautifully produced. Would love an EPUB version in a future update.",
  },
];

// avoid unused import warning when Download isn't referenced
void Download;
