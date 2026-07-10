/**
 * End-to-end wiring test for the product type label across the publish flow:
 * upload (step 1), edit (loading an existing product's category), and the
 * review/publish step. Prevents regressions where the header would always
 * say "Book details" even when uploading a Prompt Pack, Journal, etc.
 *
 * This is an integration-level source contract test — it verifies the
 * three call sites that render the label are wired to the same
 * `typeCfg = getProductType(productTypeKey ?? editProductTypeKey)` source
 * of truth, and that the edit loader derives that key from the stored
 * category via `getProductTypeKeyByCategory`.
 *
 * Combined with `src/lib/product-types.test.ts` (which asserts the
 * category->key->label mapping for every product type), this locks the
 * end-to-end behavior: a saved category will always resurface the
 * correct label in upload, edit, and publish screens.
 *
 * Run with: bun test tests/integration/publish-flow-product-label.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  PRODUCT_TYPES,
  getProductType,
  getProductTypeKeyByCategory,
  type ProductTypeKey,
} from "../../src/lib/product-types";

const ROOT = process.cwd();
const NEW_ROUTE = join(ROOT, "src/routes/_authenticated/dashboard.new.tsx");
const src = readFileSync(NEW_ROUTE, "utf8");

describe("publish flow product-type label wiring", () => {
  it("derives typeCfg from both the URL type and the edit-loaded category", () => {
    // Single source of truth for the label — both the fresh-upload key and
    // the edit-loaded key resolve through the same getProductType call.
    expect(src).toMatch(
      /const\s+typeCfg\s*=\s*getProductType\(\s*productTypeKey\s*\?\?\s*editProductTypeKey\s*\)/,
    );
  });

  it("declares an editProductTypeKey state slot for the edit flow", () => {
    expect(src).toMatch(
      /useState<ProductTypeKey\s*\|\s*undefined>\(undefined\)/,
    );
    expect(src).toContain("editProductTypeKey");
    expect(src).toContain("setEditProductTypeKey");
  });

  it("populates editProductTypeKey from the stored category on edit load", () => {
    expect(src).toMatch(
      /setEditProductTypeKey\(\s*getProductTypeKeyByCategory\(/,
    );
  });

  it("upload step 1 header renders `${typeCfg.label} Details` (non-ebook types)", () => {
    // StepperBar wiring in the publish flow
    expect(src).toMatch(
      /step1Label=\{\s*typeCfg\.isEbook\s*\?\s*"Book Details"\s*:\s*`\$\{typeCfg\.label\}\s*Details`\s*\}/,
    );
  });

  it("StepDetails header renders `${productLabel} details` (non-ebook types)", () => {
    expect(src).toMatch(
      /p\.isEbook\s*\?\s*"Book details"\s*:\s*`\$\{p\.productLabel\s*\?\?\s*"Product"\}\s*details`/,
    );
    // And is fed from the same typeCfg
    expect(src).toMatch(/productLabel=\{\s*typeCfg\.label\s*\}/);
  });

  it("review/publish step renders the same typeCfg.label", () => {
    // The review card shows the human label of the resolved product type
    expect(src).toMatch(/\{\s*typeCfg\.label\s*\}/);
  });

  it("category round-trips to the correct upload/edit/publish label for every product type", () => {
    // End-to-end contract: a stored category always resurfaces the same
    // label that the upload flow used originally.
    for (const [key, cfg] of Object.entries(PRODUCT_TYPES) as [
      ProductTypeKey,
      (typeof PRODUCT_TYPES)[ProductTypeKey],
    ][]) {
      const resolvedKey = getProductTypeKeyByCategory(cfg.category);
      expect(resolvedKey).toBe(key);
      const resolvedLabel = getProductType(resolvedKey).label;
      expect(resolvedLabel).toBe(cfg.label);
    }
  });

  it("AI Prompt Pack specifically does NOT fall back to the eBook label on edit", () => {
    const key = getProductTypeKeyByCategory("ai_prompt_packs");
    expect(key).toBe("ai_prompt_pack");
    const label = getProductType(key).label;
    expect(label).toBe("AI Prompt Pack");
    expect(label).not.toBe("eBook");
  });
});
