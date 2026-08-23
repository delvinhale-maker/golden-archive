/**
 * Static regression guard for the PDP creator-identity + SSR-linking work,
 * reconciled onto main's independently-evolved architecture (which already
 * has ProductCreatorPanel/MoreFromCreator backed by storefront.functions.ts
 * — richer than this session's original approach, so this pass only adds
 * what was still missing: SSR prefetch for those components' queries, a
 * batched creator-info join for card-grid surfaces (home rows, browse),
 * removal of the still-dead top "View Store" button, and a real fallback
 * meta description).
 *
 * Run: bun test tests/integration/pdp-creator-identity-reconciled.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const lib = read("src/lib/marketplace.functions.ts");
const homerows = read("src/lib/homerows.functions.ts");
const pdp = read("src/routes/products.$id.tsx");
const fbt = read("src/components/marketplace/FrequentlyBoughtTogether.tsx");

describe("batched creator-info join (marketplace.functions.ts)", () => {
  it("dbRowToProduct no longer accepts a fabricated sellerName override", () => {
    expect(lib).not.toMatch(/dbRowToProduct\([^)]*sellerName/);
  });

  it("dbRowToProduct's pre-join default fails safe: unverified, AurumVault-owned, no slug", () => {
    const m = lib.match(/creator:\s*\{\s*id:\s*r\.seller_id,[^}]*\}/);
    expect(m, "pre-join creator default not found").not.toBeNull();
    expect(m![0]).toContain('name: "AurumVault"');
    expect(m![0]).toContain("verified: false");
    expect(m![0]).toContain("isAurumVaultOwned: true");
  });

  it("real creator name/slug/verified only apply when the storefront is actually eligible (approved + brand_slug)", () => {
    expect(lib).toContain('const eligible = row.status === "approved" && !!row.brand_slug');
  });

  it("fetchCreatorInfoMap only selects public-safe seller_applications columns — never the privacy-fix-protected fields", () => {
    const selectMatch = lib.match(/\.from\("seller_applications"\)\s*\.select\("([^"]+)"\)/);
    expect(selectMatch).not.toBeNull();
    expect(selectMatch![1]).toBe("user_id,brand_name,brand_slug,status");
    for (const f of ["applicant_email", "admin_notes", "admin_feedback", "reapply_after"]) {
      expect(selectMatch![1]).not.toContain(f);
    }
  });

  it("fetchCreatorInfoMap is batched — exactly one .in() per table, not one query per product", () => {
    const fnBody = lib.slice(lib.indexOf("export async function fetchCreatorInfoMap"), lib.indexOf("function applyCreatorInfo"));
    expect((fnBody.match(/\.in\(/g) ?? []).length).toBe(2);
    expect(fnBody).not.toMatch(/for\s*\([^)]*\)\s*\{[\s\S]*\.from\(/);
  });

  it("wired into fetchDbProducts, getProduct, and getHomeHighlights", () => {
    const calls = lib.split("\n").filter(
      (l) => l.includes("fetchCreatorInfoMap(") && !l.includes("export async function"),
    );
    expect(calls.length).toBe(3);
  });
});

describe("homerows.functions.ts reuses the same batched join", () => {
  it("imports fetchCreatorInfoMap instead of duplicating the query", () => {
    expect(homerows).toContain("fetchCreatorInfoMap");
    expect(homerows).not.toMatch(/\.from\("seller_applications"\)/);
  });

  it("dead fallback creator default also fails safe", () => {
    expect(homerows).toContain('creator ?? { id: r.seller_id, name: "AurumVault", verified: false, isAurumVaultOwned: true }');
  });

  it("getHomeRows batches once for all rows; getProductsByIds batches once for its id list", () => {
    const getHomeRowsBody = homerows.slice(homerows.indexOf("export const getHomeRows"), homerows.indexOf("export const getProductsByIds"));
    expect((getHomeRowsBody.match(/fetchCreatorInfoMap\(/g) ?? []).length).toBe(1);
    const getProductsByIdsBody = homerows.slice(homerows.indexOf("export const getProductsByIds"));
    expect((getProductsByIdsBody.match(/fetchCreatorInfoMap\(/g) ?? []).length).toBe(1);
  });
});

describe("PDP: SSR prefetch for creator panel / more-from-creator / frequently-bought-together", () => {
  it("loader is async and awaits ensureQueryData before returning", () => {
    expect(pdp).toMatch(/loader:\s*async\s*\(\s*\{\s*context,\s*params\s*\}\s*\)\s*=>/);
  });

  it("prefetches the exact query key ProductCreatorPanel reads (creator-public-card)", () => {
    expect(pdp).toContain('queryKey: ["creator-public-card", sellerId]');
    expect(pdp).toContain("getCreatorPublicCard({ data: { sellerId } })");
  });

  it("prefetches the exact query key MoreFromCreator reads (more-from-creator)", () => {
    expect(pdp).toContain('queryKey: ["more-from-creator", sellerId, product.id ?? null]');
    expect(pdp).toContain("getMoreFromCreator({ data: { sellerId, excludeProductId: product.id } })");
  });

  it("creator/storefront prefetch is gated the same way the components gate rendering (isRealSeller)", () => {
    expect(pdp).toContain("isRealSeller = SELLER_UUID_RE.test(sellerId");
    expect(pdp).toMatch(/isRealSeller\s*\n?\s*\?\s*\[/);
  });

  it("prefetches relatedProductsQuery for FrequentlyBoughtTogether, unconditionally for any published product", () => {
    expect(pdp).toContain("ensureQueryData(relatedProductsQuery(product.category))");
  });

  it("does not import or resurrect the dead CustomersAlsoBought component", () => {
    expect(pdp).not.toContain("CustomersAlsoBought");
  });
});

describe("FrequentlyBoughtTogether reads the shared prefetched query", () => {
  it("uses useQuery(relatedProductsQuery(...)) instead of a client-only useEffect fetch", () => {
    expect(fbt).toContain("useQuery(relatedProductsQuery(product.category))");
    expect(fbt).not.toContain("useEffect");
  });
});

describe("dead storefront button removed", () => {
  it("the top-summary 'View Store' button no longer exists (ProductCreatorPanel below already links to the storefront)", () => {
    expect(pdp).not.toMatch(/<button[^>]*>\s*View Store/);
  });

  it("ProductCreatorPanel and MoreFromCreator components themselves are untouched (not reimplemented)", () => {
    const panel = read("src/components/marketplace/ProductCreatorPanel.tsx");
    const more = read("src/components/marketplace/MoreFromCreator.tsx");
    // Both still read from storefront.functions.ts via their own useQuery —
    // this pass only adds a loader-side prefetch of the same query keys,
    // it does not change how the components themselves fetch or render.
    expect(panel).toContain("getCreatorPublicCard");
    expect(more).toContain("getMoreFromCreator");
  });
});

describe("fallback meta description", () => {
  it("products.$id.tsx uses the shared deterministic fallback, not an inline generic string", () => {
    expect(pdp).toContain("buildFallbackProductDescription");
    expect(pdp).not.toContain("A premium digital resource from a verified AurumVault creator.");
  });

  it("passes real creator identity through to the fallback builder", () => {
    expect(pdp).toContain("creatorName: p.creator.name");
    expect(pdp).toContain("isAurumVaultOwned: p.creator.isAurumVaultOwned");
  });

  it("a valid custom product description is never overwritten by the fallback", () => {
    expect(pdp).toMatch(/p\.description\?\.trim\(\)\s*\n?\s*\?\s*p\.description\.replace/);
  });
});

describe("no scope creep — untouched systems", () => {
  it("main's own BreadcrumbList JSON-LD is unchanged (not replaced by a duplicate)", () => {
    expect(pdp).toContain('name: "AurumVault", item: `${SITE_URL}/`');
    expect(pdp).toContain('name: "Digital Products"');
    const breadcrumbBlocks = [...pdp.matchAll(/"@type":\s*"BreadcrumbList"/g)];
    expect(breadcrumbBlocks.length).toBe(1);
  });

  it("Product JSON-LD brand/seller fields are unchanged (AurumVault remains the merchant of record)", () => {
    expect(pdp).toContain('brand: { "@type": "Brand", name: "AurumVault" }');
    expect(pdp).toContain('seller: { "@type": "Organization", name: "AurumVault" }');
  });

  it("canonical URL logic is unchanged", () => {
    expect(pdp).toContain("links: [{ rel: \"canonical\", href: url }]");
  });

  it("taxonomy/delivery-contents/OfferCatalog structured data (main's independent work) is unchanged", () => {
    expect(pdp).toContain('"@type": "OfferCatalog"');
    expect(pdp).toContain("resolveProductType");
  });
});
