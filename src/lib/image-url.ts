/**
 * Image URL helpers for optimized cover delivery.
 *
 * Product covers live in the Supabase `product-covers` bucket. Supabase Storage
 * exposes a render/image endpoint that resizes and re-encodes on the fly (and
 * auto-negotiates WebP via the browser's Accept header). We rewrite object URLs
 * to that endpoint at request time so the same DB row serves properly sized
 * assets to phone cards (~small) and PDP heroes (~large).
 *
 * The rewrites are safe for both public (`/object/public/...`) and signed
 * (`/object/sign/...?token=...`) URLs. Non-Supabase URLs (Amazon affiliate
 * images, external CDNs) are returned unchanged.
 */

const RENDER_MARKER = "/storage/v1/render/image/";

function isSupabaseObjectUrl(url: string): boolean {
  return /\/storage\/v1\/object\/(public|sign)\//.test(url);
}

function rewriteToRender(url: string): string {
  return url.replace("/storage/v1/object/", "/storage/v1/render/image/");
}

export type CoverSize = {
  /** Rendered CSS width in px at 1x. Actual image is fetched at 2x for retina. */
  width: number;
  /** JPEG/WebP quality (1–100). Default 75. */
  quality?: number;
};

/**
 * Return a single optimized URL for a Supabase-hosted cover, or the original
 * URL for external sources.
 */
export function optimizedCoverUrl(
  src: string | null | undefined,
  size: CoverSize,
): string | null {
  if (!src) return null;
  if (!/^https?:\/\//.test(src)) return src;
  if (!isSupabaseObjectUrl(src) && !src.includes(RENDER_MARKER)) return src;

  const base = src.includes(RENDER_MARKER) ? src : rewriteToRender(src);
  const [path, query = ""] = base.split("?");
  const params = new URLSearchParams(query);
  // Fetch at 2x for retina displays, capped at 1600px.
  const target = Math.min(size.width * 2, 1600);
  params.set("width", String(target));
  params.set("quality", String(size.quality ?? 75));
  params.set("resize", "contain");
  return `${path}?${params.toString()}`;
}

/**
 * Build a responsive srcSet + sizes attribute pair for a cover image.
 * Only emitted for Supabase-hosted covers (external URLs get a plain src).
 */
export function coverSrcSet(
  src: string | null | undefined,
  widths: number[],
  quality = 75,
): string | undefined {
  if (!src || !/^https?:\/\//.test(src)) return undefined;
  if (!isSupabaseObjectUrl(src) && !src.includes(RENDER_MARKER)) return undefined;
  return widths
    .map((w) => `${optimizedCoverUrl(src, { width: w / 2, quality })} ${w}w`)
    .join(", ");
}
