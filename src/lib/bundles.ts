/**
 * Pure, client-safe bundle math and types.
 *
 * Savings are ALWAYS derived from live product prices — never stored — so a
 * price change on a member product can never leave a stale "Save $X" claim on
 * the storefront.
 */

export type BundleItem = {
  productId: string;
  title: string;
  slug: string | null;
  category: string;
  priceCents: number;
  coverUrl: string | null;
  position: number;
  required: boolean;
};

export type Bundle = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  fullDescription: string | null;
  imageUrl: string | null;
  priceCents: number;
  featured: boolean;
  status: "draft" | "active" | "archived";
  startAt: string | null;
  endAt: string | null;
  items: BundleItem[];
  /** Sum of the current list prices of every included product. */
  individualValueCents: number;
  /** individualValue - price, floored at 0. */
  savingsCents: number;
  /** Whole-percent savings, 0 when there is nothing to save. */
  savingsPct: number;
  /** True when the bundle price is >= the sum of its parts — no savings claims. */
  needsReview: boolean;
};

export function computeBundleTotals(priceCents: number, itemPrices: number[]) {
  const individualValueCents = itemPrices.reduce((n, c) => n + c, 0);
  const rawSavings = individualValueCents - priceCents;
  const savingsCents = Math.max(0, rawSavings);
  const savingsPct =
    individualValueCents > 0 && savingsCents > 0
      ? Math.round((savingsCents / individualValueCents) * 100)
      : 0;
  return {
    individualValueCents,
    savingsCents,
    savingsPct,
    needsReview: rawSavings <= 0,
  };
}

/**
 * Allocate a bundle's charged total across its member products pro-rata by
 * list price, using largest-remainder so the allocated cents sum EXACTLY to
 * `totalCents`. Every line gets at least 1 cent.
 *
 * Used by the Stripe webhook so each bundle purchase still produces one real
 * order line per product with correct payout math.
 */
export function allocateBundlePrices(totalCents: number, listPrices: number[]): number[] {
  const n = listPrices.length;
  if (n === 0) return [];
  if (totalCents <= n) {
    // Degenerate: spread whatever we have, 1 cent per line where possible.
    return listPrices.map((_, i) => (i < totalCents ? 1 : 0));
  }
  const sum = listPrices.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const base = Math.floor(totalCents / n);
    const out = new Array(n).fill(base);
    let rest = totalCents - base * n;
    for (let i = 0; rest > 0; i++, rest--) out[i]! += 1;
    return out;
  }

  const exact = listPrices.map((p) => (p * totalCents) / sum);
  const floored = exact.map((v) => Math.max(1, Math.floor(v)));
  let allocated = floored.reduce((a, b) => a + b, 0);

  // Distribute the remainder to the largest fractional parts first.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  let idx = 0;
  while (allocated < totalCents) {
    floored[order[idx % n]!.i]! += 1;
    allocated += 1;
    idx += 1;
  }
  // Over-allocation can only happen from the min-1 floor; trim the largest lines.
  while (allocated > totalCents) {
    const biggest = floored
      .map((v, i) => ({ v, i }))
      .filter((x) => x.v > 1)
      .sort((a, b) => b.v - a.v)[0];
    if (!biggest) break;
    floored[biggest.i]! -= 1;
    allocated -= 1;
  }
  return floored;
}

export function bundleIsLive(b: {
  status: string;
  startAt: string | null;
  endAt: string | null;
}): boolean {
  if (b.status !== "active") return false;
  const now = Date.now();
  if (b.startAt && new Date(b.startAt).getTime() > now) return false;
  if (b.endAt && new Date(b.endAt).getTime() <= now) return false;
  return true;
}

export function slugifyBundleName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const MERCH_SURFACES = [
  "pdp",
  "cart",
  "homepage",
  "bundle_page",
  "bundles_index",
  "post_purchase",
  "search",
] as const;
export type MerchSurface = (typeof MERCH_SURFACES)[number];
