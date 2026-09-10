import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const marketplace = read("src/lib/marketplace.functions.ts");
const productRoute = read("src/routes/products.$id.tsx");
const productCard = read("src/components/marketplace/ProductCard.tsx");
const migration = read("supabase/migrations/20260909062000_product_slug_redirects.sql");

describe("production redirect foundation source contract", () => {
  it("resolves historical slugs server-side and returns a canonical redirect result", () => {
    expect(marketplace).toContain('"resolve_product_slug_redirect"');
    expect(marketplace).toContain('kind: "redirect"');
    expect(marketplace).toContain("canonical !== identifier");
  });

  it("emits a permanent 301 from the product route", () => {
    expect(productRoute).toContain("redirect,");
    expect(productRoute).toContain('result.kind === "redirect"');
    expect(productRoute).toContain("statusCode: 301");
  });

  it("uses canonical slugs for primary product-card links", () => {
    expect(productCard).toContain("product.slug ?? product.id");
  });

  it("keeps the redirect registry private and service-role resolved", () => {
    expect(migration).toContain("generated always as (md5(old_slug)) stored primary key");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("r.old_slug = _old_slug");
    expect(migration).toContain("revoke all on table public.product_slug_redirects from public");
    expect(migration).toContain("revoke all on table public.product_slug_redirects from anon");
    expect(migration).toContain("revoke all on table public.product_slug_redirects from authenticated");
    expect(migration).toContain("grant execute on function public.resolve_product_slug_redirect(text) to service_role");
  });

  it("does not mutate product slugs in the foundation migration", () => {
    expect(migration.toLowerCase()).not.toMatch(/update\s+public\.marketplace_products[\s\S]{0,200}\bslug\b/);
  });
});
