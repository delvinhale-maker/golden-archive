import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { getBundlesForProduct } from "@/lib/bundles.functions";
import type { Bundle } from "@/lib/bundles";
import { trackMerch } from "@/lib/merch-track";

/**
 * PDP module: "this product is part of a bundle". Renders nothing when the
 * product isn't bundled, so it is safe to mount on every product page.
 */
export function BundleAndSave({ productId }: { productId: string }) {
  const [bundles, setBundles] = useState<Bundle[]>([]);

  useEffect(() => {
    let active = true;
    getBundlesForProduct({ data: { productId } })
      .then((res) => {
        if (!active) return;
        setBundles(res);
        for (const b of res) trackMerch("impression", "pdp", { bundleId: b.id, productId });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [productId]);

  if (!bundles.length) return null;

  return (
    <section className="mt-12 rounded-2xl border border-line bg-white p-5 md:p-7">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink md:text-2xl">
        <Layers size={18} className="text-gold-ink" /> Bundle &amp; save
      </h2>
      <p className="mt-1 text-sm text-mute">
        This title is included in {bundles.length === 1 ? "a bundle" : "these bundles"} — get more
        for less.
      </p>

      <ul className="mt-5 space-y-3">
        {bundles.map((b) => (
          <li
            key={b.id}
            className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="font-display text-base font-bold text-ink">{b.name}</div>
              <div className="mt-1 text-xs text-mute">
                {b.items.length} products ·{" "}
                <span className="font-semibold text-gold-ink">
                  ${(b.priceCents / 100).toFixed(2)}
                </span>
                {b.savingsCents > 0 && (
                  <>
                    {" "}
                    <span className="line-through">
                      ${(b.individualValueCents / 100).toFixed(2)}
                    </span>{" "}
                    <span className="font-semibold text-emerald-600">
                      save {b.savingsPct}%
                    </span>
                  </>
                )}
              </div>
            </div>
            <Link
              to="/bundles/$slug"
              params={{ slug: b.slug }}
              onClick={() => trackMerch("click", "pdp", { bundleId: b.id, productId })}
              className="shrink-0 rounded-full bg-gold px-5 py-2.5 text-center text-sm font-bold text-navy shadow-gold-glow"
            >
              View bundle
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
