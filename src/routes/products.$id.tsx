import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgeCheck,
  Check,
  EyeOff,
  Heart,
  Lock,
  Share2,
  Star,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ProductCover } from "@/components/marketplace/ProductCover";
import { StripeEmbeddedProductCheckout } from "@/components/StripeEmbeddedCheckout";
import { CustomersAlsoBought } from "@/components/marketplace/CustomersAlsoBought";
import { ImageZoom } from "@/components/marketplace/ImageZoom";
import { TrustBadges, KingdomGuarantee, FormatSelector } from "@/components/marketplace/TrustBadges";
import { ReviewsSection } from "@/components/marketplace/ReviewsSection";
import { QASection } from "@/components/marketplace/QASection";
import { FrequentlyBoughtTogether } from "@/components/marketplace/FrequentlyBoughtTogether";
import { ShareButtons, ReportIssueLink } from "@/components/marketplace/ShareButtons";
import { useCart, useWishlist } from "@/hooks/use-av-store";
import { getProduct, type Product, type ProductDetailResult } from "@/lib/marketplace.functions";

const productQ = (id: string) =>
  queryOptions({
    queryKey: ["mp", "product", id],
    queryFn: async () => {
      const res = await getProduct({ data: { id } });
      if (res.kind === "notFound") throw notFound();
      return res;
    },
  });


const SITE_URL = "https://www.aurumvault.store";

export const Route = createFileRoute("/products/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(productQ(params.id)),
  head: ({ params, loaderData }) => {
    const res = loaderData as ProductDetailResult | undefined;
    const p = res?.kind === "published" ? res.product : undefined;
    const isUnpublished = res?.kind === "unpublished";
    const url = `${SITE_URL}/products/${params.id}`;

    let baseTitle: string;
    let rawDesc: string;
    if (isUnpublished) {
      const t = res && res.kind === "unpublished" ? res.title : null;
      baseTitle = t
        ? `“${t}” is not yet available | AurumVault`
        : "Product not yet available | AurumVault";
      rawDesc = t
        ? `“${t}” is currently being reviewed or has been unpublished on AurumVault. Check back soon or browse other premium digital products.`
        : "This product is currently being reviewed or has been unpublished on AurumVault. Check back soon or browse other premium digital products.";
    } else if (p) {
      baseTitle = `${p.title} | AurumVault — Gold Standard Digital Commerce`;
      rawDesc = p.description?.trim()
        ? p.description.replace(/\s+/g, " ").trim()
        : "A premium digital resource from a verified AurumVault creator.";
    } else {
      baseTitle = "Product | AurumVault — Gold Standard Digital Commerce";
      rawDesc = "A premium digital resource from a verified AurumVault creator.";
    }
    const desc = rawDesc.length > 160 ? `${rawDesc.slice(0, 157)}…` : rawDesc;
    const image =
      p?.image && /^https?:\/\//.test(p.image) ? p.image : undefined;

    const meta: Array<Record<string, string>> = [
      { title: baseTitle },
      { name: "description", content: desc },
      { name: "robots", content: isUnpublished ? "noindex, follow" : "index, follow" },
      { property: "og:type", content: isUnpublished ? "website" : "product" },
      { property: "og:title", content: baseTitle },
      { property: "og:description", content: desc },
      { property: "og:url", content: url },
      { name: "twitter:title", content: baseTitle },
      { name: "twitter:description", content: desc },
    ];
    if (image) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
    }

    const scripts: Array<{ type: string; children: string }> = [];
    if (p) {
      const absImage = image ?? `${SITE_URL}/logo.png`;
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.title,
          description: rawDesc,
          image: [absImage],
          brand: { "@type": "Brand", name: "Illustrious Capital™" },
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: "USD",
            price: Number(p.price).toFixed(2),
            availability: "https://schema.org/InStock",
            seller: { "@type": "Organization", name: "Illustrious Capital™" },
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue:
              p.rating && p.reviewCount ? Number(p.rating).toFixed(1) : "5",
            reviewCount:
              p.rating && p.reviewCount ? p.reviewCount : 1,
          },
        }),
      });
    }

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  component: ProductPage,
  errorComponent: ({ reset }) => {
    const router = useRouter();
    return (
      <MarketShell>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">We couldn't load this product</h1>
          <p className="mt-3 text-mute">Please try again in a moment.</p>
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="mt-6 rounded-full bg-gold px-6 py-3 text-sm font-bold text-navy"
          >
            Try again
          </button>
        </div>
      </MarketShell>
    );
  },
  notFoundComponent: () => (
    <MarketShell>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Product not found</h1>
        <p className="mt-3 text-mute">It may have been removed.</p>
        <Link to="/products" className="mt-6 inline-block rounded-full bg-gold px-6 py-3 text-sm font-bold text-navy">
          Browse products
        </Link>
      </div>
    </MarketShell>
  ),
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data: result } = useSuspenseQuery(productQ(id));

  if (result.kind === "unpublished") {
    return (
      <MarketShell>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
            <EyeOff size={32} className="text-gold" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold text-ink">
            {result.title ? `“${result.title}” is not yet available` : "This product is not yet available"}
          </h1>
          <p className="mt-3 text-mute">
            This title is currently being reviewed or has been unpublished. Check back soon, or browse available products.
          </p>
          <Link to="/products" className="mt-6 inline-block rounded-full bg-gold px-6 py-3 text-sm font-bold text-navy">
            Browse products
          </Link>
        </div>
      </MarketShell>
    );
  }

  const product = result.product;
  const wishlist = useWishlist();
  const cart = useCart();
  const liked = wishlist.has(product.id);
  const inCart = cart.has(product.id);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const formats = useMemo(() => formatsFor(product.category), [product.category]);
  const [format, setFormat] = useState(formats[0]?.id ?? "pdf");

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
            <ImageZoom
              ariaLabel={product.title}
              renderExpanded={() => (
                <div className="aspect-[1.6/1] w-full overflow-hidden rounded-xl bg-[#f5f4ef]">
                  {product.image && /^https?:\/\//.test(product.image) ? (
                    <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
                  ) : (
                    <ProductCover
                      title={product.title}
                      category={product.category}
                      productId={product.id}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              )}
            >
              {product.image && /^https?:\/\//.test(product.image) ? (
                <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
              ) : (
                <ProductCover
                  title={product.title}
                  category={product.category}
                  productId={product.id}
                  className="h-full w-full object-cover"
                />
              )}
              {product.bestseller && (
                <span className="absolute left-4 top-4 z-10 rounded-sm bg-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-caps text-navy">
                  Bestseller
                </span>
              )}
            </ImageZoom>
            <TrustBadges />
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
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                {product.creator.name}
                {product.creator.verified && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-gold"
                    title="Verified creator"
                    aria-label="Verified creator"
                  >
                    <BadgeCheck size={12} className="text-gold" /> Verified
                  </span>
                )}
              </div>
              <button className="text-sm font-semibold text-gold hover:underline">
                View Store →
              </button>
            </div>

            {product.reviewCount > 0 ? (
              <div
                className="mt-3 flex items-center gap-2 text-sm text-mute"
                aria-label={`Rated ${product.rating.toFixed(1)} out of 5 from ${product.reviewCount} review${product.reviewCount === 1 ? "" : "s"}`}
              >
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
                <span className="font-semibold text-ink tabular-nums">{product.rating.toFixed(1)}</span>
                <span>
                  ({product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"})
                </span>
              </div>
            ) : (
              <div className="mt-3 text-sm italic text-mute">
                No reviews yet — be the first to review.
              </div>
            )}

            <div
              data-testid="pdp-price-block"
              className="mt-5 flex items-baseline gap-3"
            >
              <span
                data-testid="pdp-price"
                className="font-display text-3xl font-bold text-gold"
              >
                ${product.price.toFixed(2)}
              </span>
              {product.compareAtPrice && (
                <span
                  data-testid="pdp-compare-at"
                  className="text-base text-mute line-through"
                >
                  ${product.compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>

            <p className="mt-5 text-[15px] leading-relaxed text-mute">
              {product.description}
            </p>

            <FormatSelector formats={formats} value={format} onChange={setFormat} />

            <KingdomGuarantee />

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
              onClick={() =>
                cart.add({
                  id: product.id,
                  title: product.title,
                  price: product.price,
                  category: product.category,
                  image: product.image,
                })
              }
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-navy text-sm font-bold text-navy hover:bg-navy hover:text-white"
            >
              {inCart ? "✓ Added — View Cart" : "Add to Cart"}
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
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  {product.creator.name}
                  {product.creator.verified && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-gold"
                      title="Verified creator"
                      aria-label="Verified creator"
                    >
                      <BadgeCheck size={12} className="text-gold" /> Verified
                    </span>
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

        <ShareButtons
          title={product.title}
          url={`${SITE_URL}/products/${product.id}`}
        />

        <FrequentlyBoughtTogether product={product} />

        <ReviewsSection
          productId={product.id}
          fallbackRating={product.rating}
          fallbackCount={product.reviewCount}
        />

        <QASection productId={product.id} />

        <CustomersAlsoBought category={product.category} excludeId={product.id} />

        <ReportIssueLink title={product.title} />
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

function formatsFor(category: string): { id: string; label: string; sub?: string }[] {
  const c = category.toLowerCase();
  if (c.includes("audio")) return [
    { id: "mp3", label: "MP3", sub: "Streaming + download" },
    { id: "m4b", label: "M4B", sub: "Chaptered audiobook" },
    { id: "pdf", label: "PDF Notes", sub: "Companion guide" },
  ];
  if (c.includes("course")) return [
    { id: "video", label: "Video", sub: "HD streaming" },
    { id: "pdf", label: "PDF Workbook", sub: "Printable" },
    { id: "audio", label: "Audio", sub: "Listen on the go" },
  ];
  if (c.includes("template")) return [
    { id: "notion", label: "Notion", sub: "Duplicate to workspace" },
    { id: "pdf", label: "PDF", sub: "Print-ready" },
    { id: "docx", label: "Docx", sub: "Editable" },
  ];
  return [
    { id: "pdf", label: "PDF", sub: "Universal" },
    { id: "epub", label: "EPUB", sub: "Kindle / iBooks" },
    { id: "audio", label: "Audio", sub: "When available" },
  ];
}
