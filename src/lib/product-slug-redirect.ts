/**
 * Pure helpers for product URL canonicalisation. No DB, no router, no I/O — so
 * they are trivially testable and safe on both client and server.
 */

/**
 * The canonical `/products/$id` URL segment for a product row: its clean slug
 * when it has one, otherwise its UUID (permanently supported legacy form).
 */
export function canonicalProductSegment(row: {
  id: string;
  slug?: string | null;
}): string {
  return row.slug?.trim() || row.id;
}

/**
 * True when the requested identifier is not the canonical segment and must be
 * 301'd. Returns false when they match (loop guard) or the canonical segment is
 * missing.
 */
export function shouldRedirectProductRequest(
  requested: string,
  canonical: string,
): boolean {
  const from = requested.trim();
  const to = canonical.trim();
  if (!from || !to) return false;
  return from !== to;
}
