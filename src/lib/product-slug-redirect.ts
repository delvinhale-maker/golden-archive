export function canonicalProductSegment(product: {
  id: string;
  slug?: string | null;
}): string {
  return product.slug?.trim() || product.id;
}

export function shouldRedirectProductRequest(
  requested: string,
  product: { id: string; slug?: string | null },
): boolean {
  return canonicalProductSegment(product) !== requested;
}
