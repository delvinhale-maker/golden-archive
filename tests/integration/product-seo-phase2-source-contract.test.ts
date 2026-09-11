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
    expect(marketplace).not.toMatch(/preview_pages[^\n]*seo_focus_keyword/);
    expect(marketplace).not.toMatch(/preview_pages[^\n]*seo_secondary_keywords/);
  });

  it("requires an exact product selector and writes only SEO fields", () => {
    expect(adminRoute).toContain("product_id");
    expect(adminRoute).toContain("product_slug");
    expect(adminRoute).toContain("Provide product_id or product_slug");
    expect(adminRoute).toContain("data.length !== 1");
    expect(adminRoute).toContain("seo_updated_at");

    const patchMatch = adminRoute.match(
      /const patch: Record<string, unknown> = \{([\s\S]*?)\n    \};/,
    );
    expect(patchMatch).not.toBeNull();
    const patchBody = patchMatch?.[1] ?? "";
    for (const forbidden of [
      "title",
      "description",
      "category",
      "price_cents",
      "published",
      "status",
      "seller_id",
      "slug",
      "file_path",
    ]) {
      const bareField = new RegExp(`(^|\\n)\\s*${forbidden}\\s*:`, "m");
      expect(patchBody).not.toMatch(bareField);
    }
    for (const allowed of [
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
      expect(patchBody).toContain(allowed);
    }
    expect(adminRoute).toContain('as any)\n      .update(patch)');
    expect(adminRoute).toContain('seo_robots_index: z.boolean().optional()');
    expect(adminRoute).toContain('seo_robots_follow: z.boolean().optional()');
    expect(adminRoute).not.toContain('seo_robots_index: z.boolean().optional().default(true)');
    expect(adminRoute).not.toContain('seo_robots_follow: z.boolean().optional().default(true)');
    expect(patchBody).toContain('payload.seo_robots_index !== undefined');
    expect(patchBody).toContain('payload.seo_robots_follow !== undefined');
    expect(patchBody).toContain('payload.seo_title !== undefined');
    expect(patchBody).toContain('payload.seo_secondary_keywords !== undefined');
  });

  it("maps product-detail SEO fields without bloating list SELECTs", () => {
    for (const field of [
      "seoTitle",
      "seoDescription",
      "seoImageAlt",
      "seoOgTitle",
      "seoOgDescription",
      "seoRobotsIndex",
      "seoRobotsFollow",
    ]) {
      expect(marketplace).toContain(field);
    }
    expect(marketplace).toMatch(/preview_pages[^\n]*seo_title,seo_description/);
    expect(marketplace).toContain(
      '"id,slug,title,category,subcategory,product_type,delivery_contents,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at"',
    );
    expect(marketplace).toContain(
      '"id,slug,title,category,price_cents,cover_url,description,seller_id,created_at"',
    );
    expect(marketplace).toContain(
      '"id,slug,title,category,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at"',
    );
  });

  it("uses SEO metadata for head tags while keeping Product JSON-LD descriptive", () => {
    expect(productRoute).toContain("p?.seoTitle?.trim()");
    expect(productRoute).toContain("p?.seoDescription?.trim()");
    expect(productRoute).toContain("p?.seoOgTitle?.trim()");
    expect(productRoute).toContain("p?.seoOgDescription?.trim()");
    expect(productRoute).toContain("p?.seoImageAlt?.trim()");
    expect(productRoute).toContain("p?.seoRobotsIndex === false");
    expect(productRoute).toContain("p?.seoRobotsFollow === false");
    expect(productRoute).toContain("const metaSource = seoDescription || rawDesc");
    expect(productRoute).toMatch(/description:\s*rawDesc/);
  });

  it("keeps noindex products out of the sitemap", () => {
    expect(sitemap).toContain("seo_robots_index");
    expect(sitemap).toContain("if (row.seo_robots_index === false) continue;");
  });
});
