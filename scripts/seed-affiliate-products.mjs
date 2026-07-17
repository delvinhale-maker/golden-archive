#!/usr/bin/env node
// Bulk-seeds public.affiliate_products from a list of Amazon ASINs/URLs.
// Scrapes each product page for title/price/image (same parsing as the
// admin "Kingdom Picks Importer" at src/lib/affiliate-import.functions.ts),
// uploads the cover to the product-previews bucket, and inserts a row
// tagged with the store's Amazon Associates tag.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-affiliate-products.mjs products.txt
//   node scripts/seed-affiliate-products.mjs B08N5WRWNW https://www.amazon.com/dp/B0CRDCVQK1
//
// Input file format (one entry per line, '#' starts a comment):
//   ASIN_or_URL [| category] [| badge]
//   B08N5WRWNW | Finance | Bestseller
//
// Flags:
//   --category <name>   Default category for lines that don't specify one (default: eBooks)
//   --featured           Mark every seeded product as featured
//   --dry-run             Scrape and print, but don't write to the database
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
// (same variables the app's server-side admin client uses). Re-running is
// safe — entries whose ASIN already exists in affiliate_products are skipped.

import { readFileSync, existsSync } from "node:fs";

const AFFILIATE_TAG = "ddh0f-20";
const BUCKET = "product-previews";
const AFFILIATE_CATEGORIES = ["eBooks", "Finance", "Leadership", "Purpose", "Business", "Children", "Audio"];

function parseArgs(argv) {
  const flags = { category: "eBooks", featured: false, dryRun: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--category") { flags.category = argv[++i]; continue; }
    if (a === "--featured") { flags.featured = true; continue; }
    if (a === "--dry-run") { flags.dryRun = true; continue; }
    positional.push(a);
  }
  return { flags, positional };
}

function loadEntries(positional) {
  // A single positional arg that resolves to an existing file is read as a list.
  if (positional.length === 1 && existsSync(positional[0])) {
    return readFileSync(positional[0], "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  }
  return positional;
}

function parseEntry(line, defaultCategory) {
  const [rawInput, rawCategory, rawBadge] = line.split("|").map((s) => s?.trim());
  const category = rawCategory && AFFILIATE_CATEGORIES.includes(rawCategory) ? rawCategory : defaultCategory;
  return { input: rawInput, category, badge: rawBadge || null };
}

const ASIN_RE = /^[A-Z0-9]{10}$/;

function extractAsin(input) {
  if (!input) return null;
  const bare = input.trim().toUpperCase();
  if (ASIN_RE.test(bare)) return bare;
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/gp\/aw\/d\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i,
  ];
  for (const re of patterns) {
    const m = input.match(re);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

function buildAffiliateUrl(asin) {
  return `https://www.amazon.com/dp/${asin}?tag=${AFFILIATE_TAG}`;
}

function decodeEntities(s) {
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

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function pickMeta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
  const m = html.match(re) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

function parseTitle(html) {
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

function parseImage(html, asin) {
  const dyn = html.match(/id=["']landingImage["'][^>]*data-a-dynamic-image=["']({[^"']+})["']/i)
    || html.match(/data-a-dynamic-image=["']({[^"']+})["'][^>]*id=["']landingImage["']/i);
  if (dyn) {
    try {
      const obj = JSON.parse(decodeEntities(dyn[1]));
      let best = null, bestArea = 0;
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
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`;
}

function parsePrice(html) {
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

async function fetchAmazonHtml(asin) {
  const res = await fetch(`https://www.amazon.com/dp/${asin}/`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Amazon fetch failed: ${res.status}`);
  return await res.text();
}

async function uploadCover(supabaseAdmin, asin, sourceUrl) {
  try {
    const imgRes = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
        "Referer": "https://www.amazon.com/",
      },
      redirect: "follow",
    });
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const path = `amazon/${asin}.${ext}`;
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) {
      console.warn(`[seed-affiliate] upload failed for ${asin}: ${error.message}`);
      return null;
    }
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn(`[seed-affiliate] upload exception for ${asin}:`, err);
    return null;
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const entries = loadEntries(positional);
  if (entries.length === 0) {
    console.error("No entries given. Pass a file path or one or more ASINs/URLs.");
    process.exit(1);
  }

  let supabaseAdmin = null;
  if (!flags.dryRun) {
    const { createClient } = await import("@supabase/supabase-js");
    supabaseAdmin = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  let seeded = 0, skipped = 0, failed = 0;

  for (const rawLine of entries) {
    const { input, category, badge } = parseEntry(rawLine, flags.category);
    const asin = extractAsin(input);
    if (!asin) {
      console.warn(`[skip] Could not detect ASIN in "${input}"`);
      failed++;
      continue;
    }

    const affiliateUrl = buildAffiliateUrl(asin);

    if (!flags.dryRun) {
      const { data: existing } = await supabaseAdmin
        .from("affiliate_products")
        .select("id")
        .ilike("affiliate_url", `%/dp/${asin}%`)
        .maybeSingle();
      if (existing) {
        console.log(`[skip] ${asin} already seeded (id=${existing.id})`);
        skipped++;
        continue;
      }
    }

    try {
      const html = await fetchAmazonHtml(asin);
      const title = parseTitle(html) ?? `Amazon Product ${asin}`;
      const price = parsePrice(html) ?? 0;
      const sourceImageUrl = parseImage(html, asin);

      let imageUrl = sourceImageUrl ?? "";
      if (!flags.dryRun && sourceImageUrl) {
        const uploaded = await uploadCover(supabaseAdmin, asin, sourceImageUrl);
        if (uploaded) imageUrl = uploaded;
      }

      if (flags.dryRun) {
        console.log(`[dry-run] ${asin} — "${title}" — $${price} — ${category} — ${affiliateUrl}`);
        seeded++;
        continue;
      }

      const { error } = await supabaseAdmin.from("affiliate_products").insert({
        title,
        description: "",
        price,
        image_url: imageUrl,
        affiliate_url: affiliateUrl,
        source: "amazon",
        category,
        badge,
        featured: flags.featured,
        active: true,
      });
      if (error) throw new Error(error.message);

      console.log(`[seeded] ${asin} — "${title}" — $${price} — ${category}`);
      seeded++;
    } catch (err) {
      console.warn(`[fail] ${asin}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\nDone. seeded=${seeded} skipped=${skipped} failed=${failed}${flags.dryRun ? " (dry run — nothing written)" : ""}`);
  if (failed > 0 && seeded === 0 && skipped === 0) process.exit(1);
}

main();
