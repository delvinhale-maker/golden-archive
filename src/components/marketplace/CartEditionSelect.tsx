import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { listPublicVariants, type ProductVariant } from "@/lib/product-variants.functions";
import type { CartItem } from "@/hooks/use-av-store";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cached per product id so the cart page / drawer don't refetch on every render. */
const cache = new Map<string, ProductVariant[]>();

/**
 * Edition (variant) selector for a cart line. Renders nothing when the product
 * has no active variants, so non-variant products are untouched.
 */
export function CartEditionSelect({
  item,
  onChange,
  compact,
}: {
  item: CartItem;
  onChange: (v: { variantId: string; variantName: string; price: number }) => void;
  compact?: boolean;
}) {
  const [variants, setVariants] = useState<ProductVariant[]>(() => cache.get(item.id) ?? []);

  useEffect(() => {
    if (!UUID_RE.test(item.id) || cache.has(item.id)) return;
    let cancelled = false;
    listPublicVariants({ data: { productId: item.id } })
      .then((rows) => {
        cache.set(item.id, rows);
        if (!cancelled) setVariants(rows);
      })
      .catch(() => cache.set(item.id, []));
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  if (variants.length === 0) return null;

  const selectedId =
    item.variantId && variants.some((v) => v.id === item.variantId) ? item.variantId : "";

  const handle = (id: string) => {
    const v = variants.find((x) => x.id === id);
    if (!v) return;
    onChange({ variantId: v.id, variantName: v.name, price: v.price_cents / 100 });
  };

  return (
    <div className={compact ? "mt-1" : "mt-2"}>
      <label
        htmlFor={`edition-${item.id}-${item.variantId ?? "none"}`}
        className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-caps text-mute"
      >
        <Layers size={11} /> Edition
      </label>
      <select
        id={`edition-${item.id}-${item.variantId ?? "none"}`}
        value={selectedId}
        onChange={(e) => handle(e.target.value)}
        className="h-9 w-full max-w-xs rounded-lg border border-line bg-white px-2 text-xs font-semibold text-ink focus:border-gold focus:outline-none"
      >
        {!selectedId && <option value="">Choose an edition…</option>}
        {variants.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} — ${(v.price_cents / 100).toFixed(2)}
          </option>
        ))}
      </select>
      {selectedId && (
        <p className="mt-1 max-w-xs text-[11px] leading-snug text-mute">
          {variants.find((v) => v.id === selectedId)?.description ?? ""}
        </p>
      )}
    </div>
  );
}
