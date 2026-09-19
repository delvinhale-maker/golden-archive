/**
 * AurumVault SEO Phase 2 — additive product SEO metadata.
 *
 * Source-contract verification (route/server modules can't execute in this
 * sandbox — same pre-existing missing-package cascade documented across this
 * repo's suite), so these are real assertions against actual file content.
 *
 * Run: bunx vitest run tests/integration/product-seo-phase2.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const MIGRATION_DIR = "supabase/migrations";
const migrationFile = readdirSync(join(ROOT, MIGRATION_DIR)).find((f) =>
  f.includes("product_seo_phase2"),
)!;
const migration = read(join(MIGRATION_DIR, migrationFile));

describe("Phase 2 schema change", () => {
  const cols = [
    "seo_title text",
    "seo_description text",
    "seo_focus_keyword text",
    "seo_secondary_keywords text[] NOT NULL DEFAULT '{}'",
    "seo_image_alt text",
    "seo_og_title text",
    "seo_og_description text",
    "seo_robots_index boolean NOT NULL DEFAULT true",
    "seo_robots_follow boolean NOT NULL DEFAULT true",
    "seo_updated_at timestamptz",
  ];

  it("adds exactly the Phase 2 columns, all with IF NOT EXISTS", () => {
    for (const c of cols) expect(migration).toContain(`ADD COLUMN IF NOT EXISTS ${c}`);
    expect(migration.match(/ADD COLUMN IF NOT EXISTS/g)!.length).toBe(cols.length);
  });

  it("enforces the length limits", () => {
    expect(migration).toContain("char_length(seo_title) <= 200");
    expect(migration).toContain("char_length(seo_description) <= 500");
    expect(migration).toContain("char_length(seo_image_alt) <= 300");
  });

  it("documents keywords as internal planning fields only", () => {
    expect(migration).toMatch(/seo_focus_keyword IS[\s\S]*INTERNAL PLANNING FIELD ONLY/);
    expect(migration).toMatch(/seo_secondary_keywords IS[\s\S]*INTERNAL PLANNING FIELD ONLY/);
  });

  it("never updates, inserts into or deletes a product row", () => {
    expect(migration).not.toMatch(/\bUPDATE\s+public\.marketplace_products/i);
    expect(migration).not.toMatch(/\bINSERT\s+INTO/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM/i);
  });
});

describe("runtime product model", () => {
  const fns = read("src/lib/marketplace.functions.ts");

  it("selects the SEO columns only on the product-detail query", () => {
    const detail = fns.slice(fns.indexOf('"id,slug,title,category,subcategory'));
    expect(detail).toContain(
      "preview_pages,seo_title,seo_description,seo_image_alt,seo_og_title,seo_og_description,seo_robots_index,seo_robots_follow",
    );
  });

  it("keeps list payloads lean — no SEO columns in the catalog/home/promoted selects", () => {
    const listSelects = fns.match(/id,slug,title,[^"]*/g) ?? [];
    for (const s of listSelects) {
      if (s.includes("preview_pages")) continue; // detail select
      expect(s).not.toContain("seo_");
    }
  });

  it("maps the SEO overrides but never the internal keyword fields", () => {
    expect(fns).toContain("seoTitle: r.seo_title?.trim() || null");
    expect(fns).toContain("seoRobotsIndex: r.seo_robots_index ?? true");
    expect(fns).not.toContain("seoFocusKeyword: r.");
    expect(fns).not.toContain("seoSecondaryKeywords: r.");
  });

  it("does not change canonical slug / redirect handling", () => {
    expect(fns).toContain("resolve_product_slug_redirect");
  });
});

describe("product detail metadata precedence", () => {
  const page = read("src/routes/products.$id.tsx");

  it("prefers seo_title, seo_description and the OG overrides", () => {
    expect(page).toContain("if (seoTitle) baseTitle = seoTitle");
    expect(page).toContain("const metaSource = seoDescription || rawDesc");
    expect(page).toContain('const ogTitle = p?.seoOgTitle?.trim() || baseTitle');
    expect(page).toContain("{ property: \"og:title\", content: ogTitle }");
    expect(page).toContain('{ name: "twitter:description", content: ogDesc }');
  });

  it("honours robots flags for published products and keeps unpublished noindex, follow", () => {
    expect(page).toContain('? "noindex, follow"');
    expect(page).toContain('p?.seoRobotsIndex === false ? "noindex" : "index"');
    expect(page).toContain('p?.seoRobotsFollow === false ? "nofollow" : "follow"');
    expect(page).toContain('{ name: "robots", content: robots }');
  });

  it("overrides the visible primary image alt", () => {
    expect(page).toContain("p?.seoImageAlt?.trim() ||");
    expect(page).toContain("alt={product.seoImageAlt?.trim() || product.title}");
  });

  it("never emits meta keywords", () => {
    expect(page).not.toMatch(/name:\s*"keywords"/);
    expect(page).not.toMatch(/content:\s*p\?\.seoFocusKeyword/);
    expect(page).not.toMatch(/content:\s*p\?\.seoSecondaryKeywords/);
  });

  it("keeps Product structured data on the visible product description", () => {
    const ld = page.slice(page.indexOf('"@type": "Product"'));
    expect(ld).toContain("rawDesc");
    expect(ld).not.toContain("seoDescription");
  });
});

describe("sitemap", () => {
  const sitemap = read("src/routes/sitemap[.]xml.ts");

  it("reads seo_robots_index and omits explicitly noindexed products", () => {
    expect(sitemap).toContain("select=id,slug,updated_at,seo_robots_index");
    expect(sitemap).toContain("if (row.seo_robots_index === false) continue;");
  });

  it("keeps the existing storefront / academy behavior", () => {
    expect(sitemap).toContain("seller_applications?select=brand_slug,created_at&status=eq.approved");
    expect(sitemap).toContain("academy_categories?select=slug");
    expect(sitemap).toContain("academy_articles?select=slug,updated_at&status=eq.published");
    expect(sitemap).toContain("path: `/store/${s.brand_slug}`");
    expect(sitemap).toContain("path: `/academy/${c.slug}`");
    expect(sitemap).toContain("path: `/academy/article/${a.slug}`");
  });
});

describe("admin product SEO editor", () => {
  const route = read("src/routes/_authenticated/admin.academy.product-seo.tsx");

  it("is admin-only, matching the Academy admin route pattern", () => {
    expect(route).toContain('.from("user_roles")');
    expect(route).toContain('.eq("role", "admin")');
    expect(route).toContain('navigate({ to: "/dashboard" })');
    expect(route).toContain('{ name: "robots", content: "noindex, nofollow" }');
  });

  it("requires product_id or product_slug and never selects by title alone", () => {
    expect(route).toContain("exactly one of product_id or product_slug is required");
    expect(route).not.toMatch(/\.eq\("title"/);
    expect(route).not.toMatch(/\.ilike\("title"/);
  });

  it("delegates resolution and writes to admin-guarded server functions", () => {
    expect(route).toContain('from "@/lib/product-seo-admin.functions"');
    expect(route).toContain("useServerFn(resolveProductSeoTarget)");
    expect(route).toContain("useServerFn(saveProductSeoMetadata)");
    expect(route).toContain("await resolveSeoTarget({");
    expect(route).toContain("await saveSeo({");
  });

  it("never queries or updates marketplace_products from the browser", () => {
    expect(route).not.toContain('.from("marketplace_products")');
  });

  it("validates lengths and preserves omitted robots values", () => {
    expect(route).toContain("seo_title must be 200 characters or fewer");
    expect(route).toContain("seo_description must be 500 characters or fewer");
    expect(route).toContain("seo_image_alt must be 300 characters or fewer");
    expect(route).toContain('if (v === null || v === undefined || v === "") return undefined;');
  });

  it("normalizes secondary keywords from an array or a comma-separated string", () => {
    expect(route).toContain("if (Array.isArray(v)) return v.map((s) => String(s).trim())");
    expect(route).toContain('.split(",")');
  });

  it("offers a copyable/downloadable template", () => {
    expect(route).toContain("product-seo-template.json");
    expect(route).toContain("navigator.clipboard?.writeText");
  });

  it("is linked visibly from the Academy JSON importer", () => {
    const upload = read("src/routes/_authenticated/admin.academy.upload.tsx");
    expect(upload).toContain('to="/admin/academy/product-seo"');
    expect(upload).toContain("Open the Product SEO editor");
  });
});

describe("server-side admin authorization boundary", () => {
  const fn = read("src/lib/product-seo-admin.functions.ts");

  it("guards both resolution and save POST functions with server auth", () => {
    const resolveBlock = fn.slice(
      fn.indexOf("export const resolveProductSeoTarget"),
      fn.indexOf("export const saveProductSeoMetadata"),
    );
    const saveBlock = fn.slice(fn.indexOf("export const saveProductSeoMetadata"));
    for (const block of [resolveBlock, saveBlock]) {
      expect(block).toContain('createServerFn({ method: "POST" })');
      expect(block).toContain(".middleware([requireSupabaseAuth])");
      expect(block).toContain("await assertAdmin(context.supabase, context.userId)");
    }
    expect(resolveBlock).toContain("SelectorSchema.parse(input)");
    expect(saveBlock).toContain("InputSchema.parse(input)");
  });

  it("verifies the admin role server-side before writing", () => {
    expect(fn).toContain('supabase.rpc("has_role"');
    expect(fn).toContain('_role: "admin"');
    expect(fn).toContain('if (!isAdmin) throw new Error("Forbidden: admin only")');
    const saveHandler = fn.slice(fn.indexOf("export const saveProductSeoMetadata"));
    expect(saveHandler.indexOf("await assertAdmin(context.supabase, context.userId)")).toBeLessThan(
      saveHandler.indexOf(".update(seoUpdates as never)"),
    );
    expect(saveHandler.indexOf("await resolveTarget({")).toBeLessThan(
      saveHandler.indexOf(".update(seoUpdates as never)"),
    );
  });

  it("requires product_id or product_slug and never resolves by title", () => {
    expect(fn).toContain("exactly one of product_id or product_slug is required");
    expect(fn).toContain("SLUG_RE");
    expect(fn).not.toMatch(/\.eq\("title"/);
    expect(fn).not.toMatch(/\.ilike\("title"/);
  });

  it("updates exactly the allowed SEO keys plus seo_updated_at", () => {
    const upd = fn.slice(fn.indexOf("const seoUpdates"), fn.indexOf('.eq("id", product.id)'));
    const keys = [
      ...upd.matchAll(/seoUpdates\.(seo_[a-z_]+)\s*=/g),
      ...upd.matchAll(/\{\s*(seo_updated_at):/g),
    ].map((m) => m[1]).sort();
    expect(keys).toEqual(
      [
        "seo_description",
        "seo_focus_keyword",
        "seo_image_alt",
        "seo_og_description",
        "seo_og_title",
        "seo_robots_follow",
        "seo_robots_index",
        "seo_secondary_keywords",
        "seo_title",
        "seo_updated_at",
      ].sort(),
    );
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
      expect(keys).not.toContain(forbidden);
    }
  });

  it("enforces length limits and preserves omitted optional values", () => {
    expect(fn).toContain("text(200)");
    expect(fn).toContain("text(500)");
    expect(fn).toContain("text(300)");
    expect(fn).toContain("if (data.seo_robots_index !== undefined)");
    expect(fn).toContain("if (data.seo_robots_follow !== undefined)");
    expect(fn).toContain("if (data.seo_title !== undefined)");
    expect(fn).not.toContain("?? true");
  });
});