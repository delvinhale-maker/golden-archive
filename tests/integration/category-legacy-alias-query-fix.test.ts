/**
 * Regression guard for the Business Systems / Creator Business Tools
 * "empty department" bug.
 *
 * Root cause (confirmed by direct code inspection, not guessed): the
 * department pages/rows correctly query the canonical enum slugs
 * (business_operating_systems, creator_business_tools), and
 * categories.ts's LEGACY_ALIAS map already knew that the deprecated
 * `business` enum value is really "Business Systems" — but that alias was
 * only ever applied for *display* (slugToLabel), never for *filtering*.
 * A product still stored under the old `business` value would render with
 * the right label everywhere else on the site, yet never surface on
 * /business-systems, because fetchDbProducts issued a single
 * `.eq("category", "business_operating_systems")` with no awareness of the
 * legacy value. Compounding it, the "New Product" form still offered the
 * deprecated value as a first-class, easily-confused option
 * ("Business Systems" vs. plain "Business"), so the trap could keep
 * recurring for new products, not just old ones.
 *
 * This suite locks in the fix: an alias-aware query (categories.ts's
 * getQueryableSlugsFor(), used by marketplace.functions.ts's
 * fetchDbProducts) that matches every legacy slug aliasing to a canonical
 * one, plus removal of the deprecated options from the create/edit form so
 * the trap cannot recur. No product data was duplicated or deleted by this
 * fix — existing rows keep their current category value; only the query
 * that reads them changed.
 *
 * Run: bun test tests/integration/category-legacy-alias-query-fix.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getQueryableSlugsFor } from "@/lib/categories";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const marketplaceFn = read("src/lib/marketplace.functions.ts");
const dashboardNew = read("src/routes/_authenticated/dashboard.new.tsx");

describe("getQueryableSlugsFor — pure, real executed assertions", () => {
  it("includes the deprecated 'business' legacy slug when querying business_operating_systems", () => {
    expect(getQueryableSlugsFor("business_operating_systems")).toEqual([
      "business_operating_systems",
      "business",
    ]);
  });

  it("returns just the canonical slug for a category with no legacy alias (creator_business_tools)", () => {
    expect(getQueryableSlugsFor("creator_business_tools")).toEqual(["creator_business_tools"]);
  });

  it("resolves every LEGACY_ALIAS target correctly (leadership/finance/purpose too)", () => {
    expect(getQueryableSlugsFor("business_templates")).toContain("leadership");
    expect(getQueryableSlugsFor("budget_spreadsheets")).toContain("finance");
    expect(getQueryableSlugsFor("printable_journals")).toContain("purpose");
  });

  it("never drops the canonical slug itself, even with aliases present", () => {
    expect(getQueryableSlugsFor("business_operating_systems")).toContain(
      "business_operating_systems",
    );
  });
});

describe("marketplace.functions.ts — fetchDbProducts is alias-aware, not a single .eq()", () => {
  it("imports getQueryableSlugsFor from categories.ts instead of re-deriving aliases locally", () => {
    expect(marketplaceFn).toMatch(
      /import\s*\{[\s\S]{0,200}getQueryableSlugsFor[\s\S]{0,50}\}\s*from\s*"@\/lib\/categories"/,
    );
  });

  it("uses .in(...) for the category filter when legacy aliases exist, falling back to .eq() for a single slug", () => {
    const fnBody = marketplaceFn.slice(
      marketplaceFn.indexOf("async function fetchDbProducts"),
      marketplaceFn.indexOf("export type Creator"),
    );
    expect(fnBody).toMatch(/getQueryableSlugsFor\(\s*slug,?\s*\)/);
    expect(fnBody).toContain('query.in("category", queryableSlugs)');
    expect(fnBody).toContain('query.eq("category", queryableSlugs[0])');
  });
});

describe("dashboard.new.tsx — deprecated category values removed from the create/edit form", () => {
  const categoriesBlock = dashboardNew.slice(
    dashboardNew.indexOf("const CATEGORIES:"),
    dashboardNew.indexOf("const LANGUAGES"),
  );

  it("no longer offers the four deprecated legacy values as selectable options", () => {
    for (const deprecated of [
      'value: "finance"',
      'value: "leadership"',
      'value: "purpose"',
      'value: "business"',
    ]) {
      expect(categoriesBlock).not.toContain(deprecated);
    }
  });

  it("still offers both canonical Business Systems and Creator Business Tools options", () => {
    expect(categoriesBlock).toContain('value: "business_operating_systems"');
    expect(categoriesBlock).toContain('value: "creator_business_tools"');
  });

  it("still offers the non-deprecated categories unrelated to this bug (no unrelated removals)", () => {
    for (const kept of [
      'value: "ebooks"',
      'value: "financial_planners"',
      'value: "ai_prompt_packs"',
      'value: "printable_journals"',
      'value: "childrens_educational"',
      'value: "business_templates"',
      'value: "audio"',
      'value: "templates"',
    ]) {
      expect(categoriesBlock).toContain(kept);
    }
  });
});
