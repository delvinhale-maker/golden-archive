import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read("supabase/migrations/20260910162000_product_seo_metadata.sql");
const adminRoute = read("src/routes/_authenticated/admin.academy.product-seo.tsx");
const adminFns = read("src/lib/product-seo-admin.functions.ts");
const marketplace = read("src/lib/marketplace.functions.ts");
const productRoute = read("src/routes/products.$id.tsx");
const sitemap = read("src/routes/sitemap[.]xml.ts");

describe("Phase 2 product SEO schema", () => {
  it("adds the ten additive SEO fields without mutating product rows", () => {
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
    expect(migration).not.toMatch(/\bupdate\s+public\.marketplace_products/i);
    expect(migration).not.toMatch(/\binsert\s+into\s+public\.marketplace_products/i);
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\.marketplace_products/i);
    expect(migration).not.toMatch(/set\s+slug\s*=/i);
  });

  it("marks focus and secondary keywords as internal planning only", () => {
    expect(migration).toMatch(/Internal SEO planning field/i);
    expect(migration).toMatch(/Internal SEO planning terms/i);
  });
});

describe("Phase 2 product detail behavior", () => {
  it("reads SEO overrides only on the product detail path", () => {
    expect(marketplace).toMatch(/preview_pages[^\n]*seo_title,seo_description/);
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
    expect(marketplace).toContain(
      '"id,slug,title,category,subcategory,product_type,delivery_contents,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at"',
    );
  });

  it("preserves canonical redirect handling", () => {
    expect(marketplace).toContain("resolve_product_slug_redirect");
    expect(marketplace).toContain("canonicalProductSegment");
    expect(marketplace).toContain("shouldRedirectProductRequest");
  });

  it("applies title, description, social, image-alt and robots overrides", () => {
    expect(productRoute).toContain("p?.seoTitle?.trim()");
    expect(productRoute).toContain("const metaSource = seoDescription || rawDesc");
    expect(productRoute).toContain("p?.seoOgTitle?.trim()");
    expect(productRoute).toContain("p?.seoOgDescription?.trim()");
    expect(productRoute).toContain("p?.seoImageAlt?.trim()");
    expect(productRoute).toContain('p?.seoRobotsIndex === false ? "noindex" : "index"');
    expect(productRoute).toContain('p?.seoRobotsFollow === false ? "nofollow" : "follow"');
    expect(productRoute).toMatch(/description:\s*rawDesc/);
  });

  it("never emits meta keywords", () => {
    expect(productRoute).not.toMatch(/name:\s*["']keywords["']/i);
    expect(productRoute).not.toMatch(/seoFocusKeyword/);
    expect(productRoute).not.toMatch(/seoSecondaryKeywords/);
  });

  it("omits explicitly noindexed products from the sitemap", () => {
    expect(sitemap).toContain("seo_robots_index");
    expect(sitemap).toContain("if (row.seo_robots_index === false) continue;");
  });
});

describe("Phase 2 admin security boundary", () => {
  it("uses authenticated server functions for both resolve and save", () => {
    for (const exportName of ["resolveProductSeoTarget", "saveProductSeoMetadata"]) {
      const start = adminFns.indexOf(`export const ${exportName}`);
      expect(start).toBeGreaterThan(-1);
      const block = adminFns.slice(start, start + 1200);
      expect(block).toContain('createServerFn({ method: "POST" })');
      expect(block).toContain(".middleware([requireSupabaseAuth])");
      expect(block).toContain("await assertAdmin(context.supabase, context.userId)");
    }
  });

  it("checks the authenticated user for the admin role before privileged access", () => {
    expect(adminFns).toContain('supabase.rpc("has_role"');
    expect(adminFns).toContain('_role: "admin"');
    expect(adminFns).toContain('if (!isAdmin) throw new Error("Forbidden: admin only")');
    const save = adminFns.slice(adminFns.indexOf("export const saveProductSeoMetadata"));
    expect(save.indexOf("await assertAdmin(context.supabase, context.userId)")).toBeLessThan(
      save.indexOf("supabaseAdmin"),
    );
    expect(save.indexOf("await assertAdmin(context.supabase, context.userId)")).toBeLessThan(
      save.indexOf(".update(seoUpdates as never)"),
    );
  });

  it("requires exactly one product id or current slug and never targets by title", () => {
    expect(adminFns).toContain("exactly one of product_id or product_slug is required");
    expect(adminFns).not.toMatch(/\.eq\("title"/);
    expect(adminFns).not.toMatch(/\.ilike\("title"/);
    expect(adminRoute).toContain("exactly one of product_id or product_slug is required");
  });

  it("limits writes to SEO fields plus seo_updated_at", () => {
    const save = adminFns.slice(adminFns.indexOf("const seoUpdates"), adminFns.indexOf('.eq("id", product.id)'));
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
      expect(save).toContain(allowed);
    }
    for (const forbidden of [
      "slug:",
      "title:",
      "description:",
      "category:",
      "price_cents:",
      "status:",
      "published:",
      "seller_id:",
      "file_path:",
    ]) {
      expect(save).not.toContain(forbidden);
    }
  });

  it("has no browser-side marketplace_products read or write path", () => {
    expect(adminRoute).toContain("useServerFn(resolveProductSeoTarget)");
    expect(adminRoute).toContain("useServerFn(saveProductSeoMetadata)");
    expect(adminRoute).not.toContain('.from("marketplace_products")');
    expect(adminRoute).not.toContain(".update(");
  });
});
