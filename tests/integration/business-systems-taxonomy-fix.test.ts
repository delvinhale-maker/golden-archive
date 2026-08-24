/**
 * Static regression guard for the Business Systems taxonomy corrective
 * upgrade: the storefront's Business Systems chip navigation
 * (business-systems.ts/.tsx) and the static subcategory fallback
 * (categories.ts) were still on the old function-based grouping (AI
 * Business Systems, Creator Business Systems, Marketing Systems, Sales &
 * Client Systems, Operations & Productivity Systems) after migration
 * 20260823183902 seeded the canonical System Types (Interactive Decision
 * Tools, Complete Business Systems, Live Dashboards & Calculators,
 * Operating Systems, Assessment & Scoring Tools) into product_subcategories
 * — so any chip beyond "All" filtered against a subcategory value no live
 * admin dropdown, filter, or product could ever have, returning zero
 * results. This suite locks in the fix: one canonical name list, referenced
 * (not copied) everywhere it's needed.
 *
 * Run: bun test tests/integration/business-systems-taxonomy-fix.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const categories = read("src/lib/categories.ts");
const businessSystemsLib = read("src/lib/business-systems.ts");
const businessSystemsPage = read("src/routes/business-systems.tsx");
const marketplaceFn = read("src/lib/marketplace.functions.ts");
const migration = read(
  "supabase/migrations/20260824000308_normalize_business_systems_subcategories.sql",
);
const migrationSql = migration
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

const CANONICAL_SYSTEM_TYPES = [
  "Interactive Decision Tools",
  "Complete Business Systems",
  "Live Dashboards & Calculators",
  "Operating Systems",
  "Assessment & Scoring Tools",
];

const OLD_SYSTEM_TYPES = [
  "AI Business Systems",
  "Creator Business Systems",
  "Marketing Systems",
  "Sales & Client Systems",
  "Operations & Productivity Systems",
];

describe("categories.ts — single source of truth for Business Systems subcategories", () => {
  it("no old function-based System Type name remains anywhere in categories.ts", () => {
    for (const old of OLD_SYSTEM_TYPES) {
      expect(categories).not.toContain(old);
    }
  });

  it("all five canonical System Types are present", () => {
    for (const name of CANONICAL_SYSTEM_TYPES) {
      expect(categories).toContain(name);
    }
  });

  it("the CategoryDef.subs array and the SUBCATEGORIES map entry for business_operating_systems agree", () => {
    const defSubsMatch = categories.match(
      /slug: "business_operating_systems",[\s\S]*?subs: \[([\s\S]*?)\],/,
    );
    const subcategoriesMapMatch = categories.match(/business_operating_systems: \[([\s\S]*?)\],/);
    expect(
      defSubsMatch,
      "CategoryDef.subs for business_operating_systems not found",
    ).not.toBeNull();
    expect(
      subcategoriesMapMatch,
      "SUBCATEGORIES.business_operating_systems not found",
    ).not.toBeNull();
    const parseList = (block: string) => [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(parseList(defSubsMatch![1])).toEqual(CANONICAL_SYSTEM_TYPES);
    expect(parseList(subcategoriesMapMatch![1])).toEqual(CANONICAL_SYSTEM_TYPES);
  });
});

describe("business-systems.ts — chip list derives from categories.ts, not a third copy", () => {
  it("imports SUBCATEGORIES from categories.ts instead of hard-coding the name list again", () => {
    expect(businessSystemsLib).toContain('import { SUBCATEGORIES } from "@/lib/categories"');
    expect(businessSystemsLib).toContain("SUBCATEGORIES[BUSINESS_SYSTEMS_SLUG]");
  });

  it("no old function-based System Type name remains in business-systems.ts", () => {
    for (const old of OLD_SYSTEM_TYPES) {
      expect(businessSystemsLib).not.toContain(old);
    }
  });

  it("the removed BusinessSystemType grouping (ai-business/marketing/etc.) is gone, not just renamed", () => {
    expect(businessSystemsLib).not.toContain("BusinessSystemType");
    expect(businessSystemsLib).not.toContain('"ai-business"');
  });

  it("the flagship product's displayed subcategory matches its new canonical classification", () => {
    // "The AI Small Business Operating System" -> System Type: Operating Systems (spec reference mapping).
    expect(businessSystemsLib).toMatch(/subcategory:\s*"Operating Systems"/);
  });
});

describe("business-systems.tsx — chip navigation", () => {
  it("the 'All' chip reads 'All Business Systems', not a bare 'All'", () => {
    expect(businessSystemsPage).toContain('"All Business Systems"');
    expect(businessSystemsPage).not.toMatch(/useState<string>\("All"\)/);
  });

  it("still filters real products by the selected chip's subcategory", () => {
    expect(businessSystemsPage).toContain('(p.subcategory ?? "") === sub.name');
  });
});

describe("search includes category, not just title/description/taxonomy text (spec §18)", () => {
  it("fetchDbProducts's free-text search also matches against category labels", () => {
    const fnBody = marketplaceFn.slice(
      marketplaceFn.indexOf("async function fetchDbProducts"),
      marketplaceFn.indexOf("export type Creator"),
    );
    expect(fnBody).toContain("category.eq.");
    expect(fnBody).toMatch(/c\.label\.toLowerCase\(\)\.includes\(lower\)/);
  });

  it("does not shadow the local mock-rotation CATEGORIES array (naming collision regression)", () => {
    // marketplace.functions.ts already declares its own local `CATEGORIES`
    // (category-name pool for rotateHalfDay mock data) — the categories.ts
    // import must be aliased, never a second top-level `CATEGORIES`.
    expect(marketplaceFn).toMatch(
      /CATEGORIES as CATEGORY_DEFS[\s\S]{0,20}\}\s*from\s*"@\/lib\/categories"/,
    );
    expect(marketplaceFn).toContain("const CATEGORIES = [");
  });
});

describe("legacy product migration (spec §7)", () => {
  it("is additive and scoped only to business_operating_systems", () => {
    expect(migration).not.toContain("DELETE FROM");
    expect(migration).not.toContain("DROP ");
    const scopeCount = (migrationSql.match(/category = 'business_operating_systems'/g) ?? [])
      .length;
    const updateCount = (migrationSql.match(/^UPDATE /gm) ?? []).length;
    expect(scopeCount).toBe(updateCount);
  });

  it("maps every old System Type name to a canonical one", () => {
    for (const old of OLD_SYSTEM_TYPES) {
      expect(migration).toContain(`subcategory = '${old}'`);
    }
  });

  it("classifies the three unambiguous named reference products exactly per spec", () => {
    const blocks = migration.split(/(?=^UPDATE )/m);

    const roiBlock = blocks.find((b) => b.includes("Creator Performance & ROI"));
    expect(roiBlock, "no UPDATE block for Creator Performance & ROI").toBeTruthy();
    expect(roiBlock).toContain("subcategory = 'Interactive Decision Tools'");
    expect(roiBlock).toContain("product_type = 'complete_digital_system'");

    const opportunityBlock = blocks.find((b) => b.includes("Digital Product Opportunity"));
    expect(opportunityBlock, "no UPDATE block for Digital Product Opportunity").toBeTruthy();
    expect(opportunityBlock).toContain("subcategory = 'Interactive Decision Tools'");
    expect(opportunityBlock).toContain("product_type = 'complete_digital_system'");

    const aiOsBlock = blocks.find((b) => b.includes("AI Small Business Operating System"));
    expect(aiOsBlock, "no UPDATE block for AI Small Business Operating System").toBeTruthy();
    expect(aiOsBlock).toContain("subcategory = 'Operating Systems'");
    expect(aiOsBlock).toContain("product_type = 'complete_digital_system'");
  });

  it("does NOT force-classify the ambiguous Creator AI Rights & Licensing product's System Type", () => {
    // Spec explicitly says its System Type is "Interactive Decision Tools or
    // Operating System based on the current implementation" — an automated
    // migration must not guess between the two. The name may appear in an
    // explanatory comment (why it's excluded); it must not appear inside an
    // actual UPDATE statement.
    expect(migrationSql).not.toContain("Creator AI Rights");
  });
});
