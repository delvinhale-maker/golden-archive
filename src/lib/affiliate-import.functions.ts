import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AFFILIATE_CATEGORIES } from "@/lib/affiliate";

const AFFILIATE_TAG = "ddh0f-20";
const BUCKET = "product-previews";

export type AffiliatePreview = {
  asin: string;
  title: string;
  price: number | null;
  imageUrl: string; // public URL in product-previews bucket (or source URL as fallback)
  sourceImageUrl: string | null;
  affiliateUrl: string;
};

export type SaveAffiliateInput = {
  asin: string;
  title: string;
  price: number;
  imageUrl: string;
  affiliateUrl: string;
  category: (typeof AFFILIATE_CATEGORIES)[number] | string;
  description?: string;
  featured?: boolean;
  badge?: string | null;
};

const ASIN_RE = /^[A-Z0-9]{10}$/;

export function extractAsin(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const bare = trimmed.toUpperCase();
  if (ASIN_RE.test(bare)) return bare;
  // Try URL patterns
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/gp\/aw\/d\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

function buildAffiliateUrl(asin: string): string {
  return `https://www.amazon.com/dp/${asin}?tag=${AFFILIATE_TAG}`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function pickMeta(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re) ||
    html.match(new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
      "i",
    ));
  return m ? decodeEntities(m[1]) : null;
}

function parseTitle(html: string): string | null {
  const m1 = html.match(/<span[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
  if (m1) {
    const t = stripTags(decodeEntities(m1[1]));
    if (t) return t;
  }
  const og = pickMeta(html, "og:title");
  if (og) return og.replace(/\s*:\s*Amazon\.com.*$/i, "").trim();
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleTag) {
    return stripTags(decodeEntities(titleTag[1]))
      .replace(/\s*:\s*Amazon\.com.*$/i, "")
      .replace(/^Amazon\.com\s*:\s*/i, "")
      .trim();
  }
  return null;
}

function parseImage(html: string, asin: string): string | null {
  // Prefer high-res data-a-dynamic-image (largest key by area)
  const dyn = html.match(/id=["']landingImage["'][^>]*data-a-dynamic-image=["']({[^"']+})["']/i)
    || html.match(/data-a-dynamic-image=["']({[^"']+})["'][^>]*id=["']landingImage["']/i);
  if (dyn) {
    try {
      const raw = decodeEntities(dyn[1]);
      const obj = JSON.parse(raw) as Record<string, [number, number]>;
      let best: string | null = null;
      let bestArea = 0;
      for (const [url, dims] of Object.entries(obj)) {
        const area = (dims?.[0] ?? 0) * (dims?.[1] ?? 0);
        if (area > bestArea) { bestArea = area; best = url; }
      }
      if (best) return best;
    } catch { /* fall through */ }
  }
  const hires = html.match(/data-old-hires=["']([^"']+)["']/i);
  if (hires && hires[1]) return hires[1];
  const og = pickMeta(html, "og:image");
  if (og) return og;
  // Last-ditch: canonical image endpoint (may 404)
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`;
}

function parsePrice(html: string): number | null {
  // Prefer visible a-offscreen price
  const rxes = [
    /<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*\$?([\d,]+\.\d{2})/i,
    /id=["']priceblock_ourprice["'][^>]*>\s*\$?([\d,]+\.\d{2})/i,
    /id=["']priceblock_dealprice["'][^>]*>\s*\$?([\d,]+\.\d{2})/i,
    /id=["']priceblock_saleprice["'][^>]*>\s*\$?([\d,]+\.\d{2})/i,
    /"priceAmount":\s*([\d.]+)/i,
  ];
  for (const rx of rxes) {
    const m = html.match(rx);
    if (m) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

async function fetchAmazonHtml(asin: string): Promise<string> {
  const url = `https://www.amazon.com/dp/${asin}/`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Amazon fetch failed: ${res.status}`);
  }
  return await res.text();
}

async function uploadCover(
  asin: string,
  sourceUrl: string,
): Promise<{ publicUrl: string; storagePath: string } | null> {
  try {
    const imgRes = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
        "Referer": "https://www.amazon.com/",
      },
      redirect: "follow",
    });
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png"
      : contentType.includes("webp") ? "webp"
      : "jpg";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const path = `amazon/${asin}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType,
        upsert: true,
        cacheControl: "31536000",
      });
    if (error) {
      console.warn("[import-affiliate] upload failed", error.message);
      return null;
    }
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, storagePath: path };
  } catch (err) {
    console.warn("[import-affiliate] upload exception", err);
    return null;
  }
}

async function assertAdmin(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin role required");
}

/** Fetch Amazon product page, parse it, upload cover to bucket, return preview. */
export const previewAffiliateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { input: string }) => {
    if (!input?.input || typeof input.input !== "string") {
      throw new Error("input required");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<AffiliatePreview> => {
    await assertAdmin(context as any);
    const asin = extractAsin(data.input);
    if (!asin) throw new Error("Could not detect ASIN. Paste an Amazon URL or 10-char ASIN.");

    const html = await fetchAmazonHtml(asin);
    const title = parseTitle(html) ?? `Amazon Product ${asin}`;
    const price = parsePrice(html);
    const sourceImageUrl = parseImage(html, asin);

    let imageUrl = sourceImageUrl ?? "";
    if (sourceImageUrl) {
      const up = await uploadCover(asin, sourceImageUrl);
      if (up) imageUrl = up.publicUrl;
    }

    return {
      asin,
      title,
      price,
      imageUrl,
      sourceImageUrl,
      affiliateUrl: buildAffiliateUrl(asin),
    };
  });

/** Bulk preview — one ASIN or URL per line. Ignores blank lines. */
export const previewAffiliateProductsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { inputs: string[] }) => {
    if (!Array.isArray(input?.inputs)) throw new Error("inputs must be an array");
    return { inputs: input.inputs.slice(0, 50) };
  })
  .handler(async ({ data, context }): Promise<
    Array<{ input: string; ok: boolean; preview?: AffiliatePreview; error?: string }>
  > => {
    await assertAdmin(context as any);
    const out: Array<{ input: string; ok: boolean; preview?: AffiliatePreview; error?: string }> = [];
    for (const raw of data.inputs) {
      const line = raw.trim();
      if (!line) continue;
      try {
        const asin = extractAsin(line);
        if (!asin) { out.push({ input: line, ok: false, error: "Could not detect ASIN" }); continue; }
        const html = await fetchAmazonHtml(asin);
        const title = parseTitle(html) ?? `Amazon Product ${asin}`;
        const price = parsePrice(html);
        const sourceImageUrl = parseImage(html, asin);
        let imageUrl = sourceImageUrl ?? "";
        if (sourceImageUrl) {
          const up = await uploadCover(asin, sourceImageUrl);
          if (up) imageUrl = up.publicUrl;
        }
        out.push({
          input: line,
          ok: true,
          preview: { asin, title, price, imageUrl, sourceImageUrl, affiliateUrl: buildAffiliateUrl(asin) },
        });
      } catch (err) {
        out.push({ input: line, ok: false, error: err instanceof Error ? err.message : "Failed" });
      }
    }
    return out;
  });

/** Persist a confirmed preview as an affiliate_products row. */
export const saveAffiliateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveAffiliateInput) => {
    if (!input?.asin || !input?.title || !input?.imageUrl || !input?.affiliateUrl) {
      throw new Error("Missing required fields");
    }
    if (!(input.price >= 0)) throw new Error("Price must be >= 0");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("affiliate_products")
      .insert({
        title: data.title,
        description: data.description ?? "",
        price: data.price,
        image_url: data.imageUrl,
        affiliate_url: data.affiliateUrl,
        source: "amazon",
        category: data.category || "eBooks",
        badge: data.badge ?? null,
        featured: !!data.featured,
        active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });
