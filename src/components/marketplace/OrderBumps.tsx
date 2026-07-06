import { useEffect, useState } from "react";
import { listOrderBumpsForProduct, type OrderBump } from "@/lib/order-bumps.functions";
import { ProductCover } from "@/components/marketplace/ProductCover";

type Props = {
  productId: string;
  onSelectionChange?: (selectedIds: string[]) => void;
};

/**
 * Buyer-facing order-bump strip shown above the checkout form. Each bump is
 * one-click and adds an extra order_item at the discounted price.
 */
export function OrderBumps({ productId, onSelectionChange }: Props) {
  const [bumps, setBumps] = useState<OrderBump[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    listOrderBumpsForProduct({ data: { productId } })
      .then((rows) => {
        if (!cancelled) setBumps(rows);
      })
      .catch(() => {
        if (!cancelled) setBumps([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    onSelectionChange?.(Array.from(selected));
  }, [selected, onSelectionChange]);

  if (!bumps || bumps.length === 0) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-caps text-mute">
        Add to your order
      </div>
      {bumps.map((b) => {
        const priceCents = Math.max(
          50,
          Math.round(b.bump.priceCents * (1 - b.discountPercent / 100)),
        );
        const price = (priceCents / 100).toFixed(2);
        const isSel = selected.has(b.bumpProductId);
        return (
          <label
            key={b.id}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition ${
              isSel ? "border-gold bg-gold/5" : "border-line bg-white hover:border-gold/50"
            }`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-gold"
              checked={isSel}
              onChange={() => toggle(b.bumpProductId)}
            />
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
              {b.bump.coverUrl ? (
                <img
                  src={b.bump.coverUrl}
                  alt={b.bump.title}
                  className="h-12 w-12 object-cover"
                />
              ) : (
                <ProductCover
                  title={b.bump.title}
                  category="eBooks"
                  productId={b.bump.id}
                  className="h-12 w-12"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-ink">
                Yes, add {b.bump.title}
              </div>
              <div className="text-xs text-mute">
                +${price}
                {b.discountPercent > 0 && (
                  <span className="ml-1 text-emerald-600">
                    ({b.discountPercent}% off)
                  </span>
                )}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
