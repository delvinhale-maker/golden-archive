/**
 * Deterministic fallback meta description for a product with no (or empty)
 * custom description. Built only from real, per-product data — title,
 * category, and (when available) real public creator identity — so
 * distinct products never emit the exact same fallback.
 *
 * `creatorName` must be the real public brand name (from an approved,
 * publicly-eligible seller_application — see marketplace.functions.ts's
 * fetchCreatorInfoMap), never a private/legal name. When the product is
 * AurumVault-owned or the creator has no public storefront yet,
 * `isAurumVaultOwned` should be true (or `creatorName` omitted) and the
 * fallback omits the "by {creator}" clause entirely rather than crediting
 * a generic "AurumVault" as if it were a specific creator.
 */
export function buildFallbackProductDescription(product: {
  title: string;
  category?: string | null;
  creatorName?: string | null;
  isAurumVaultOwned?: boolean;
}): string {
  const title = product.title.trim();
  if (!title) {
    return "A premium digital resource available on AurumVault.";
  }
  const category = product.category?.trim();
  const creator =
    !product.isAurumVaultOwned && product.creatorName?.trim()
      ? product.creatorName.trim()
      : undefined;

  if (category && creator) {
    return `Explore ${title}, a ${category} digital resource by ${creator}, available on AurumVault.`;
  }
  if (category) {
    return `Explore ${title}, a ${category} digital resource available on AurumVault.`;
  }
  if (creator) {
    return `Explore ${title}, a digital resource by ${creator}, available on AurumVault.`;
  }
  return `Explore ${title}, a digital resource available on AurumVault.`;
}
