import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getProductRecommendations, type RecommendedEntry } from "@/lib/bundles.functions";
import { trackMerch } from "@/lib/merch-track";
import { ProductCover } from "./ProductCover";

/**
 * Shown after a successful purchase. Curated recommendations first, with a
 * same-category fallback handled server-side, so the module is only hidden
 * when there is genuinely nothing else to show.
 */
export function PostPurchaseRecommendations({ productId }: { productId: string | null }) {
  const [entries, setEntries] = useState<RecommendedEntry[]>([]);

  useEffect(() => {
    if (!productId) return;
    let active = true;
    getProductRecommendations({ data: { productId, kind: "post_purchase" } })
      .then((res) => {
        if (!active) return;
        setEntries(res.slice(0, 4));
        for (const e of res.slice(0, 4)) {
          trackMerch("impression", "post_purchase", {
            bundleId: e.kind === "bundle" ? e.bundle.id : undefined,
            productId: e.kind === "product" ? e.product.productId : undefined,
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [productId]);

  if (!entries.length) return null;

  return (
    <section className="mt-12 text-left">
      <h2 className="text-center font-display text-xl font-bold text-ink">
        Complete your toolkit
      </h2>
      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        {entries.map((e) =>
          e.kind === "bundle" ? (
            <Link
              key={`b-${e.bundle.id}`}
              to="/bundles/$slug"
              params={{ slug: e.bundle.slug }}
              onClick={() =>
                trackMerch("click", "post_purchase", { bundleId: e.bundle.id })
              }
              className="group block overflow-hidden rounded-xl border border-line bg-white p-3 transition hover:border-gold"
            >
              <div className="aspect-[1.6/1] overflow-hidden rounded-lg bg-[#f5f4ef]">
                {e.bundle.imageUrl ? (
                  <img
                    src={e.bundle.imageUrl}
                    alt={e.bundle.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : e.bundle.items[0] ? (
                  <ProductCover
                    title={e.bundle.items[0].title}
                    category={e.bundle.items[0].category}
                    productId={e.bundle.items[0].productId}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="mt-2 text-[10px] font-semibold tracking-caps text-gold-ink">
                BUNDLE · {e.bundle.items.length} PRODUCTS
              </div>
              <div className="mt-1 line-clamp-2 font-display text-sm font-bold text-ink">
                {e.bundle.name}
              </div>
              <div className="mt-1 font-display text-sm font-bold text-gold-ink">
                ${(e.bundle.priceCents / 100).toFixed(2)}
              </div>
            </Link>
          ) : (
            <Link
              key={`p-${e.product.productId}`}
              to="/products/$id"
              params={{ id: e.product.productId }}
              onClick={() =>
                trackMerch("click", "post_purchase", { productId: e.product.productId })
              }
              className="group block overflow-hidden rounded-xl border border-line bg-white p-3 transition hover:border-gold"
            >
              <div className="aspect-[1.6/1] overflow-hidden rounded-lg bg-[#f5f4ef]">
                {e.product.coverUrl && /^https?:\/\//.test(e.product.coverUrl) ? (
                  <img
                    src={e.product.coverUrl}
                    alt={e.product.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ProductCover
                    title={e.product.title}
                    category={e.product.category}
                    productId={e.product.productId}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="mt-2 text-[10px] font-semibold tracking-caps text-gold-ink">
                {e.product.category.toUpperCase()}
              </div>
              <div className="mt-1 line-clamp-2 font-display text-sm font-bold text-ink">
                {e.product.title}
              </div>
              <div className="mt-1 font-display text-sm font-bold text-gold-ink">
                ${(e.product.priceCents / 100).toFixed(2)}
              </div>
            </Link>
          ),
        )}
      </div>
    </section>
  );
}
