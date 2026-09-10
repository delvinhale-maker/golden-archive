import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read("supabase/migrations/20260910162000_product_seo_metadata.sql");
const adminRoute = read("src/routes/_authenticated/admin.academy.product-seo.tsx");
const marketplace = read("src/lib/marketplace.functions.ts");
const productRoute = read("src/routes/products.$id.tsx");
const sitemap = read("src/routes/sitemap[.]xml.ts");

describe("Phase 2 product SEO contract", () => {
  it("adds the additive SEO schema without mutating product rows", () => {
    for (const column of [
      "seo_title",
      "seo_description",
      "seo_focus_keyword",
      "seo_secondary_keywords",
      "seo_image_alt",
      "seo_og_title",
      "seo_og_description",
      "seo_robots_index",
      "seo_robots_follow",
      "seo_updated_at",
    ]) {
      expect(migration).toContain(column);
    }
    expect(migration).toContain("marketplace_products_seo_title_len");
    expect(migration).toContain("marketplace_products_seo_description_len");
    expect(migration).toContain("marketplace_products_seo_image_alt_len");
    expect(migration).not.toMatch(/update\s+public\.marketplace_products/i);
    expect(migration).not.toMatch(/set\s+slug\s*=/i);
  });

  it("keeps keyword fields internal and never emits meta keywords", () => {
    expect(migration).toMatch(/Internal SEO planning field/i);
    expect(migration).toMatch(/Internal SEO planning terms/i);
    expect(productRoute).not.toMatch(/name:\s*["']keywords["']/i);
    expect(productRoute).not.toMatch(/seoFocusKeyword/);
    expect(productRoute).not.toMatch(/seoSecondaryKeywords/);
  });

  it("requires an exact product selector and writes only SEO fields", () => {
    expect(adminRoute).toContain("product_id");
    expect(adminRoute).toContain("product_slug");
    expect(adminRoute).toContain("Provide product_id or product_slug");
    expect(adminRoute).toContain("data.length !== 1");
    expect(adminRoute).toContain("seo_updated_at");
    expect(adminRoute).not.toMatch(/title:\s*product\.title/);
    expect(adminRoute).not.toMatch(/category:\s/);
    expect(adminRoute).not.toMatch(/price_cents:\s/);
    expect(adminRoute).not.toMatch(/published:\s/);
    expect(adminRoute).not.toMatch(/seller_id:\s/);
    expect(adminRoute).toContain('as any)\n      .update(patch)');
  });

  it("maps product-detail SEO fields without bloating list SELECTs", () => {
    expect(marketplace).toContain("seoTitle");
    expect(marketplace).toContain("seoDescription");
    expect(marketplace).toContain("seoImageAlt");
    expect(marketplace).toContain("seoOgTitle");
    expect(marketplace).toContain("seoOgDescription");
    expect(marketplace).toContain("seoRobotsIndex");
    expect(marketplace).toContain("seoRobotsFollow");
    expect(marketplace).toMatch(/preview_pages[^\n]*seo_title,seo_description/);
    const listSelects = marketplace.match(/id,slug,title,category[^"\n]*/g) ?? [];
    expect(listSelects.some((select) => select.includes("seo_title"))).toBe(false);
  });

  it("uses SEO metadata for head tags while keeping Product JSON-LD descriptive", () => {
    expect(productRoute).toContain("p.seoTitle?.trim()");
    expect(productRoute).toContain("p.seoDescription?.trim()");
    expect(productRoute).toContain("p?.seoOgTitle?.trim()");
    expect(productRoute).toContain("p?.seoOgDescription?.trim()");
    expect(productRoute).toContain("p?.seoImageAlt?.trim()");
    expect(productRoute).toContain("p?.seoRobotsIndex === false");
    expect(productRoute).toContain("p?.seoRobotsFollow === false");
    expect(productRoute).toContain("structuredProductDescription");
    expect(productRoute).toMatch(/description:\s*structuredProductDescription/);
  });

  it("keeps noindex products out of the sitemap", () => {
    expect(sitemap).toContain("seo_robots_index");
    expect(sitemap).toContain("if (row.seo_robots_index === false) continue;");
  });
});
