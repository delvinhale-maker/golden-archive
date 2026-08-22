import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import type { Bundle, MerchSurface } from "@/lib/bundles";
import { trackMerch } from "@/lib/merch-track";
import { ProductCover } from "./ProductCover";

/**
 * Storefront bundle tile. White surface, gold accents — matches the product
 * card language so bundles read as first-class catalog entries.
 */
export function BundleCard({
  bundle,
  surface,
  compact = false,
}: {
  bundle: Bundle;
  surface: MerchSurface;
  compact?: boolean;
}) {
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    trackMerch("impression", surface, { bundleId: bundle.id });
  }, [bundle.id, surface]);

  const cover = bundle.items[0];

  return (
    <Link
      to="/bundles/$slug"
      params={{ slug: bundle.slug }}
      onClick={() => trackMerch("click", surface, { bundleId: bundle.id })}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white p-3 transition hover:-translate-y-1 hover:border-gold hover:shadow-card-hover"
    >
      <div className="relative aspect-[1.6/1] overflow-hidden rounded-lg bg-[#f5f4ef]">
        {bundle.imageUrl ? (
          <img
            src={bundle.imageUrl}
            alt={bundle.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : cover ? (
          <ProductCover
            title={cover.title}
            category={cover.category}
            productId={cover.productId}
            className="h-full w-full object-cover"
          />
        ) : null}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-white">
          <Layers size={10} /> Bundle
        </span>
        {bundle.savingsPct > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-navy">
            Save {bundle.savingsPct}%
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-1 flex-col">
        <div className="text-[10px] font-semibold tracking-caps text-gold-ink">
          {bundle.items.length} PRODUCTS
        </div>
        <h3 className="mt-1 line-clamp-2 font-display text-base font-bold text-ink">
          {bundle.name}
        </h3>
        {!compact && bundle.shortDescription && (
          <p className="mt-1 line-clamp-2 text-xs text-mute">{bundle.shortDescription}</p>
        )}
        <div className="mt-auto flex items-baseline gap-2 pt-3">
          <span className="font-display text-lg font-bold text-gold-ink">
            ${(bundle.priceCents / 100).toFixed(2)}
          </span>
          {bundle.savingsCents > 0 && (
            <span className="text-xs text-mute line-through">
              ${(bundle.individualValueCents / 100).toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
