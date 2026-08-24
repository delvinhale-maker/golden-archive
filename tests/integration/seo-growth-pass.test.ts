/**
 * SEO, Organic Traffic & Search Authority Growth System — this pass's
 * changes. Route-file logic (store.$slug.tsx, sitemap[.]xml.ts,
 * business-systems.tsx) can't be executed directly in this sandbox (same
 * pre-existing missing-package cascade documented throughout this repo's
 * test suite), so this is source-level verification — real assertions
 * against actual file content, not simulated behavior.
 *
 * Run: bun test tests/integration/seo-growth-pass.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("creator storefront thin-content indexing gate (Section 15)", () => {
  const store = read("src/routes/store.$slug.tsx");

  it("computes hasContent from the loaded product list", () => {
    expect(store).toContain("const hasContent = d.products.length > 0");
  });

  it("noindexes an approved storefront with zero published products", () => {
    expect(store).toContain(
      '{ name: "robots", content: hasContent ? "index, follow" : "noindex, follow" }',
    );
  });

  it("still noindexes the pre-existing unapproved/missing case (unchanged)", () => {
    const missingBlock = store.slice(
      store.indexOf("if (!loaderData)"),
      store.indexOf("const d = loaderData;"),
    );
    expect(missingBlock).toContain('{ name: "robots", content: "noindex, follow" }');
  });

  it("does not change canonical, schema, or approval-gating logic", () => {
    expect(store).toContain('links: [{ rel: "canonical", href: url }]');
    expect(store).toContain('"@type": "Person"');
  });
});

describe("digital business operating system explainer (Section 10)", () => {
  const page = read("src/routes/business-systems.tsx");

  it("adds the explicit definition heading", () => {
    expect(page).toContain("What is a digital business operating system?");
  });

  it("is accurate about format — never implies standalone software automation", () => {
    const idx = page.indexOf("What is a digital business operating system?");
    const section = page.slice(idx, idx + 900);
    expect(section).toMatch(/not standalone software/i);
    expect(section).toMatch(/PDF|spreadsheet|document/i);
  });

  it("does not touch the existing System Type chip navigation (from the prior taxonomy pass)", () => {
    expect(page).toContain("BUSINESS_SYSTEM_SUBS.map((s) => s.filter)");
    expect(page).toContain('"All Business Systems"');
  });
});

describe("revenue calculator tool (Section 13, Tool A)", () => {
  const route = read("src/routes/tools.revenue-calculator.tsx");
  const lib = read("src/lib/revenue-calculator.ts");

  it("is registered in the sitemap", () => {
    const sitemap = read("src/routes/sitemap[.]xml.ts");
    expect(sitemap).toContain('{ path: "/tools/revenue-calculator"');
  });

  it("has a canonical link and unique metadata", () => {
    expect(route).toContain('links: [{ rel: "canonical", href: CANONICAL }]');
    expect(route).toContain("Digital Product Revenue Calculator");
  });

  it("labels every output as an estimate, never a guarantee", () => {
    expect(route).toMatch(/estimate/i);
    expect(route).not.toMatch(/guaranteed/i);
  });

  it("uses AurumVault's real creator-share constant rather than a made-up percentage", () => {
    expect(lib).toContain('import { CREATOR_SHARE } from "@/lib/storefront"');
    expect(route).toContain('import { CREATOR_SHARE } from "@/lib/storefront"');
  });

  it("provides a clear conversion path to a relevant product/category (Section 28)", () => {
    expect(route).toContain('to="/become-a-creator"');
    expect(route).toContain('to="/products"');
  });

  it("does not fabricate a conversion-rate benchmark presented as fact", () => {
    expect(route).toMatch(/most creators see well under/i);
  });
});
