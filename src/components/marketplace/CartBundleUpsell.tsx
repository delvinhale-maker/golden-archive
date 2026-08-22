import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Layers, Sparkles } from "lucide-react";
import { getBundlesForProduct } from "@/lib/bundles.functions";
import type { Bundle } from "@/lib/bundles";
import { trackMerch } from "@/lib/merch-track";
import type { CartItem } from "@/hooks/use-av-store";

/**
 * Cart upsell: if the cart already holds a bundle member, show the bundle and
 * the extra saving versus buying the same titles line by line.
 */
export function CartBundleUpsell({ items }: { items: CartItem[] }) {
  const ids = useMemo(() => items.map((i) => i.id).slice(0, 6), [items]);
  const [bundle, setBundle] = useState<Bundle | null>(null);

  useEffect(() => {
    let active = true;
    if (!ids.length) {
      setBundle(null);
      return;
    }
    (async () => {
      for (const id of ids) {
        try {
          const res = await getBundlesForProduct({ data: { productId: id } });
          const best = res
            .filter((b) => b.savingsCents > 0)
            .sort((a, b) => b.savingsCents - a.savingsCents)[0];
          if (best && active) {
            setBundle(best);
            trackMerch("impression", "cart", { bundleId: best.id });
            return;
          }
        } catch {
          /* ignore */
        }
      }
      if (active) setBundle(null);
    })();
    return () => {
      active = false;
    };
  }, [ids.join(",")]);

  if (!bundle) return null;

  const inCart = new Set(items.map((i) => i.id));
  const missing = bundle.items.filter((it) => !inCart.has(it.productId));

  return (
    <div className="rounded-xl border border-gold/60 bg-[#fffdf5] p-5">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-caps text-gold-ink">
        <Sparkles size={12} /> Bundle upgrade
      </div>
      <h3 className="mt-2 font-display text-lg font-bold text-ink">{bundle.name}</h3>
      <p className="mt-1 text-xs text-mute">
        {missing.length > 0
          ? `Add ${missing.length} more title${missing.length === 1 ? "" : "s"} and pay the bundle price.`
          : "You already have every title — the bundle price is lower."}
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-xl font-bold text-gold-ink">
          ${(bundle.priceCents / 100).toFixed(2)}
        </span>
        <span className="text-xs text-mute line-through">
          ${(bundle.individualValueCents / 100).toFixed(2)}
        </span>
        <span className="text-xs font-semibold text-emerald-600">save {bundle.savingsPct}%</span>
      </div>
      <Link
        to="/bundles/$slug"
        params={{ slug: bundle.slug }}
        onClick={() => trackMerch("click", "cart", { bundleId: bundle.id })}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy px-4 py-2.5 text-sm font-bold text-white"
      >
        <Layers size={14} /> See the bundle
      </Link>
    </div>
  );
}
