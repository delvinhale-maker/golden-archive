export type RankableProduct = {
  id: string;
  title: string;
  category: string;
  subcategory?: string | null;
  description?: string;
  productType?: string | null;
  rating: number;
  reviewCount: number;
};

const tokens = (s: string) =>
  new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((x) => x.length > 2));

export function rankProducts(objective: string, needs: string[], products: RankableProduct[]) {
  const intentTokens = tokens([objective, ...needs].join(" "));
  return products
    .map((product) => {
      const haystack = tokens([product.title, product.category, product.subcategory ?? "", product.description ?? "", product.productType ?? ""].join(" "));
      let overlap = 0;
      for (const token of intentTokens) if (haystack.has(token)) overlap += 1;
      const lexical = intentTokens.size ? overlap / intentTokens.size : 0;
      const trust = Math.min(1, (product.rating / 5) * 0.65 + Math.log10(product.reviewCount + 1) / 4 * 0.35);
      const score = Math.min(1, lexical * 0.82 + trust * 0.18);
      return {
        productId: product.id,
        score,
        reason: overlap > 0 ? `Matches ${overlap} part${overlap === 1 ? "" : "s"} of what you described.` : "A related marketplace option.",
      };
    })
    .sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId));
}
