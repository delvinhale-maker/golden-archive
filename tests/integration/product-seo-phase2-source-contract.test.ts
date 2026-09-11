import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read("supabase/migrations/20260910162000_product_seo_metadata.sql");
const adminRoute = read("src/routes/_authenticated/admin.academy.product-seo.tsx");
const adminFn = read("src/lib/product-seo-admin.functions.ts");
const marketplace = read("src/lib/marketplace.functions.ts");
const productRoute = read("src/routes/products.$id.tsx");
const sitemap = read("src/routes/sitemap[.]xml.ts");
const upload = read("src/routes/_authenticated/admin.academy.upload.tsx");

describe("Phase 2 product SEO contract", () => {
  it("adds exactly ten additive SEO columns without mutating product rows", () => {
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
    expect(migration.match(/add column if not exists/gi)?.length).toBe(10);
    expect(migration).toContain("marketplace_products_seo_title_len");
    expect(migration).toContain("marketplace_products_seo_description_len");
    expect(migration).toContain("marketplace_products_seo_image_alt_len");
    expect(migration).not.toMatch(/update\s+public\.marketplace_products/i);
    expect(migration).not.toMatch(/insert\s+into\s+public\.marketplace_products/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.marketplace_products/i);
    expect(migration).not.toMatch(/set\s+slug\s*=/i);
  });

  it("keeps keyword planning fields internal and never emits meta keywords", () => {
    expect(migration).toMatch(/Internal SEO planning field/i);
    expect(migration).toMatch(/Internal SEO planning terms/i);
    expect(productRoute).not.toMatch(/name:\s*["']keywords["']/i);
    expect(productRoute).not.toMatch(/seoFocusKeyword/);
    expect(productRoute).not.toMatch(/seoSecondaryKeywords/);
  });

  it("uses authenticated server-side admin boundaries for resolve and save", () => {
    expect(adminFn).toContain('createServerFn({ method: "POST" })');
    expect(adminFn).toContain(".middleware([requireSupabaseAuth])");
    expect(adminFn).toContain("await assertAdmin(context.userId)");
    expect(adminFn).toContain('.from("user_roles")');
    expect(adminFn).toContain('.eq("role", "admin")');
    expect(adminRoute).toContain("useServerFn(resolveProductSeoTarget)");
    expect(adminRoute).toContain("useServerFn(saveProductSeoMetadata)");
    expect(adminRoute).not.toMatch(/\.from\("marketplace_products"\)/);
    expect(adminRoute).not.toMatch(/\.update\(/);
  });

  it("requires product id or clean slug and never resolves by title", () => {
    expect(adminFn).toContain("product_id or product_slug is required");
    expect(adminFn).toContain("CLEAN_SLUG_RE");
    expect(adminFn).not.toMatch(/\.eq\("title"/);
    expect(adminFn).not.toMatch(/\.ilike\("title"/);
    expect(adminRoute).toContain("product_id");
    expect(adminRoute).toContain("product_slug");
  });

  it("restricts writes to SEO fields plus seo_updated_at", () => {
    const patch = adminFn.slice(adminFn.indexOf("const patch:"), adminFn.indexOf("const { error }"));
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
      expect(patch).toContain(allowed);
    }
    for (const forbidden of [
      "slug",
      "title",
      "description",
      "category",
      "price_cents",
      "status",
      "published",
      "seller_id",
      "file_path",
    ]) {
      expect(patch).not.toMatch(new RegExp(`patch\\.${forbidden}\\b|${forbidden}\\s*:`));
    }
  });

  it("maps detail-only SEO overrides while preserving redirect handling", () => {
    expect(marketplace).toMatch(/preview_pages[^\n]*seo_title,seo_description/);
    expect(marketplace).toContain("seoTitle: r.seo_title?.trim() || null");
    expect(marketplace).toContain("seoRobotsIndex: r.seo_robots_index ?? true");
    expect(marketplace).toContain("resolve_product_slug_redirect");
  });

  it("uses metadata precedence while keeping Product JSON-LD descriptive", () => {
    expect(productRoute).toContain("p?.seoTitle?.trim()");
    expect(productRoute).toContain("p?.seoDescription?.trim()");
    expect(productRoute).toContain("p?.seoOgTitle?.trim()");
    expect(productRoute).toContain("p?.seoOgDescription?.trim()");
    expect(productRoute).toContain("p?.seoImageAlt?.trim()");
    expect(productRoute).toContain("p?.seoRobotsIndex === false");
    expect(productRoute).toContain("p?.seoRobotsFollow === false");
    expect(productRoute).toMatch(/description:\s*rawDesc/);
  });

  it("omits noindex products from sitemap and keeps the Academy importer separate", () => {
    expect(sitemap).toContain("seo_robots_index");
    expect(sitemap).toContain("if (row.seo_robots_index === false) continue;");
    expect(upload).toContain('to="/admin/academy/product-seo"');
    expect(upload).toContain("Open the Product SEO editor");
  });
});
