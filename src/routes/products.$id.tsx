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
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, BookOpen } from "lucide-react";
import { ManuscriptPreviewer } from "@/components/marketplace/ManuscriptPreviewer";
import { getPublicPreview } from "@/lib/preview.functions";
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
import { useOwnsProduct } from "@/hooks/use-owned-products";
import { getProduct, type Product, type ProductDetailResult } from "@/lib/marketplace.functions";
import { listPublicVariants, type ProductVariant } from "@/lib/product-variants.functions";
import { VariantPicker, type SelectedVariant } from "@/components/marketplace/VariantPicker";
import { OrderBumps } from "@/components/marketplace/OrderBumps";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { CATEGORY_THEMES, DEFAULT_THEME } from "@/lib/theme/theme-config";


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
          brand: { "@type": "Brand", name: "AurumVault" },
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: "USD",
            price: Number(p.price).toFixed(2),
            availability: "https://schema.org/InStock",
            seller: { "@type": "Organization", name: "AurumVault" },
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
  const owned = useOwnsProduct(product.id);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [bumpIds, setBumpIds] = useState<string[]>([]);

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selected, setSelected] = useState<SelectedVariant | null>(null);

  // Public preview modal state — only surfaces when the creator picked
  // preview pages and the manuscript is a PDF.
  const previewAvailable =
    (product.previewPages?.length ?? 0) > 0 && product.fileExt === "pdf";
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewStage, setPreviewStage] = useState(0); // 0..3
  const [previewProgress, setPreviewProgress] = useState(0); // 0..100
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const previewBlobRef = useRef<string | null>(null);
  const previewTickerRef = useRef<number | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
      if (previewTickerRef.current) window.clearInterval(previewTickerRef.current);
      previewAbortRef.current?.abort();
    };
  }, []);
  function cancelPreview() {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (previewTickerRef.current) {
      window.clearInterval(previewTickerRef.current);
      previewTickerRef.current = null;
    }
    setPreviewOpen(false);
    setPreviewLoading(false);
    setPreviewProgress(0);
    setPreviewStage(0);
  }
  async function openPreview() {
    if (previewLoading) return;
    // Open modal immediately with skeleton so the user sees instant response.
    setPreviewLoading(true);
    setPreviewStage(1);
    setPreviewProgress(4);
    setPreviewBlobUrl(null);
    setPreviewOpen(true);
    // Fresh abort controller so the user can cancel the in-flight request.
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    // Simulated staged progress — we can't stream a base64 JSON body, so
    // pace the bar against realistic timings for the fetch → watermark →
    // render stages the server actually performs.
    if (previewTickerRef.current) window.clearInterval(previewTickerRef.current);
    previewTickerRef.current = window.setInterval(() => {
      setPreviewProgress((p) => {
        const next = p + (p < 40 ? 3 : p < 75 ? 1.4 : 0.4);
        const capped = Math.min(next, 92);
        setPreviewStage(capped < 35 ? 1 : capped < 75 ? 2 : 3);
        return capped;
      });
    }, 180);
    try {
      const res = await getPublicPreview({
        data: { productId: product.id },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!("ok" in res) || !res.ok) {
        setPreviewOpen(false);
        toast.error("Preview is temporarily unavailable. Please try again shortly.");
        return;
      }
      const bin = atob(res.pdfBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
      const url = URL.createObjectURL(blob);
      previewBlobRef.current = url;
      setPreviewStage(3);
      setPreviewProgress(100);
      // Brief settle so the 100% state is visible before the reader appears.
      await new Promise((r) => setTimeout(r, 220));
      if (controller.signal.aborted) {
        URL.revokeObjectURL(url);
        previewBlobRef.current = null;
        return;
      }
      setPreviewBlobUrl(url);
    } catch (e) {
      if (controller.signal.aborted) return;
      console.error("[preview] load failed", e);
      setPreviewOpen(false);
      toast.error("Preview is temporarily unavailable. Please try again shortly.");
    } finally {
      if (previewTickerRef.current) {
        window.clearInterval(previewTickerRef.current);
        previewTickerRef.current = null;
      }
      if (previewAbortRef.current === controller) previewAbortRef.current = null;
      setPreviewLoading(false);
    }
  }


  useEffect(() => {
    let cancelled = false;
    listPublicVariants({ data: { productId: product.id } })
      .then((rows) => {
        if (!cancelled) setVariants(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  const hasVariants = variants.length > 0;
  const displayPrice = hasVariants && selected
    ? selected.priceCents / 100
    : product.price;

  const formats = useMemo(() => formatsFor(product.category), [product.category]);
  const [format, setFormat] = useState(formats[0]?.id ?? "pdf");

  // Auto-set accent color for this product's category (Amazon-style theming).
  const { setActiveTheme } = useTheme();
  useEffect(() => {
    const key = product.category?.toLowerCase();
    const theme = (key && CATEGORY_THEMES[key]) || DEFAULT_THEME;
    setActiveTheme(theme);
  }, [product.category, setActiveTheme]);


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
                <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-[#f5f4ef]">
                  {product.image && /^https?:\/\//.test(product.image) ? (
                    <img src={product.image} alt={product.title} className="h-full w-full object-contain" />
                  ) : (
                    <ProductCover
                      title={product.title}
                      category={product.category}
                      productId={product.id}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
              )}
            >
              {product.image && /^https?:\/\//.test(product.image) ? (
                <img src={product.image} alt={product.title} className="h-full w-full object-contain" />
              ) : (
                <ProductCover
                  title={product.title}
                  category={product.category}
                  productId={product.id}
                  className="h-full w-full object-contain"
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
            <div
              className="text-[11px] font-semibold tracking-caps"
              style={{ color: "var(--accent-color)" }}
            >
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
                      fill={i < Math.round(product.rating) ? "var(--accent-color)" : "none"}
                      stroke="var(--accent-color)"
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
                className="font-display text-3xl font-bold"
                style={{ color: "var(--accent-color)" }}
              >
                ${displayPrice.toFixed(2)}
              </span>
              {!hasVariants && product.compareAtPrice && (
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

            {hasVariants && (
              <VariantPicker variants={variants} onChange={setSelected} />
            )}

            {!hasVariants && (
              <FormatSelector formats={formats} value={format} onChange={setFormat} />
            )}

            <KingdomGuarantee />

            {product.isPreorder && (
              <div className="mt-5 rounded-xl border border-gold/40 bg-gold/10 p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-caps text-gold">
                  Pre-order
                </div>
                <div className="mt-1 text-sm font-bold text-ink">
                  Releases {product.releaseDate ? new Date(product.releaseDate).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "soon"}
                </div>
                {product.preorderNote && (
                  <p className="mt-1 text-xs text-mute">{product.preorderNote}</p>
                )}
              </div>
            )}

            {owned ? (
              <Link
                to="/library"
                className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-full border-2 border-gold bg-navy text-base font-bold text-gold shadow-gold-glow hover:bg-navy/90"
                aria-label="You already own this — open your library"
              >
                ✓ You own this · Open Library
              </Link>
            ) : (
              <>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setCheckoutOpen(true)}
                  disabled={hasVariants && !selected}
                  className="mt-6 flex h-[52px] w-full items-center justify-center rounded-full text-base font-bold text-navy shadow-gold-glow disabled:opacity-60"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  {product.isPreorder ? "Pre-order Now" : "Buy Now"} · ${displayPrice.toFixed(2)}
                </motion.button>

                {!hasVariants && (
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
                )}
              </>

            )}

            {previewAvailable && (
              <button
                type="button"
                onClick={openPreview}
                disabled={previewLoading}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-navy/20 bg-white text-sm font-bold text-navy hover:border-navy/40 disabled:opacity-60"
              >
                {previewLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Opening preview…</>
                ) : (
                  <><BookOpen size={16} /> Preview inside — {product.previewPages!.length} pages</>
                )}
              </button>
            )}


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

            {/* What's included — only for non-ebook products with content */}
            {product.included && product.included.length > 0 && (
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
              <div className="p-4">
                <OrderBumps productId={product.id} onSelectionChange={setBumpIds} />
                <StripeEmbeddedProductCheckout
                  key={bumpIds.join(",")}
                  productId={product.id}
                  variantId={selected?.variant.id}
                  buyerPriceCents={selected?.priceCents}
                  bumpProductIds={bumpIds}
                />

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {previewOpen && previewBlobUrl && (
        <ManuscriptPreviewer
          manuscriptPath={`${previewBlobUrl}#.pdf`}
          title={`${product.title} — Preview`}
          coverUrl={product.image && /^https?:\/\//.test(product.image) ? product.image : null}
          onClose={() => setPreviewOpen(false)}
        />
      )}
      {previewOpen && !previewBlobUrl && (
        <PreviewLoadingOverlay
          title={product.title}
          coverUrl={product.image ?? null}
          pageCount={product.previewPages?.length ?? 0}
          stage={previewStage}
          progress={previewProgress}
          onCancel={() => {
            if (previewTickerRef.current) {
              window.clearInterval(previewTickerRef.current);
              previewTickerRef.current = null;
            }
            setPreviewOpen(false);
            setPreviewLoading(false);
          }}
        />
      )}
    </MarketShell>
  );
}

function PreviewLoadingOverlay({
  title,
  coverUrl,
  pageCount,
  stage,
  progress,
  onCancel,
}: {
  title: string;
  coverUrl: string | null;
  pageCount: number;
  stage: number;
  progress: number;
  onCancel: () => void;
}) {
  const steps = [
    { id: 1, label: "Fetching your preview" },
    { id: 2, label: "Applying watermark" },
    { id: 3, label: "Rendering pages" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Preparing preview"
    >
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel preview"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20"
      >
        <X size={18} />
      </button>
      <div className="w-full max-w-md rounded-2xl bg-paper p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="relative h-24 w-[68px] flex-shrink-0 overflow-hidden rounded-md bg-ink/10">
            {coverUrl ? (
              <>
                <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                {/* Sheen sweep to signal activity */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                />
              </>
            ) : (
              <div className="h-full w-full animate-pulse bg-ink/15" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-caps text-mute">
              Preparing preview
            </div>
            <h3 className="mt-0.5 truncate text-base font-bold text-navy" title={title}>
              {title}
            </h3>
            <p className="mt-1 text-xs text-mute">
              Watermarking {pageCount} page{pageCount === 1 ? "" : "s"} for you…
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-navy to-gold"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
              transition={{ ease: "easeOut", duration: 0.4 }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-semibold text-mute">
            <span>{Math.round(progress)}%</span>
            <span>Usually under 5 seconds</span>
          </div>
        </div>

        <ol className="mt-4 space-y-2">
          {steps.map((s) => {
            const done = stage > s.id || progress >= 100;
            const active = stage === s.id && !done;
            return (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    done
                      ? "border-gold bg-gold text-navy"
                      : active
                      ? "border-navy text-navy"
                      : "border-ink/20 text-mute"
                  }`}
                >
                  {done ? (
                    <Check size={12} strokeWidth={3} />
                  ) : active ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <span className="text-[10px] font-bold">{s.id}</span>
                  )}
                </span>
                <span className={done ? "text-navy line-through decoration-navy/30" : active ? "font-semibold text-navy" : "text-mute"}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Skeleton page thumbnails to hint at what's coming */}
        <div className="mt-5 grid grid-cols-5 gap-1.5">
          {Array.from({ length: Math.max(1, Math.min(5, pageCount)) }).map((_, i) => (
            <div
              key={i}
              className="relative aspect-[3/4] overflow-hidden rounded-md bg-ink/5"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-ink/5 via-ink/10 to-ink/5"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
              />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
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
