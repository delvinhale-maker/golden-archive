import { describe, it, expect } from "vitest";
import {
  PRODUCT_TYPES,
  getProductType,
  getProductTypeKeyByCategory,
  type ProductTypeKey,
} from "./product-types";

describe("getProductTypeKeyByCategory", () => {
  it("maps every product type's category back to its own key", () => {
    for (const [key, cfg] of Object.entries(PRODUCT_TYPES) as [
      ProductTypeKey,
      (typeof PRODUCT_TYPES)[ProductTypeKey],
    ][]) {
      expect(getProductTypeKeyByCategory(cfg.category)).toBe(key);
    }
  });

  it("maps ai_prompt_packs category to the AI Prompt Pack label (edit flow header)", () => {
    const key = getProductTypeKeyByCategory("ai_prompt_packs");
    expect(key).toBe("ai_prompt_pack");
    expect(getProductType(key).label).toBe("AI Prompt Pack");
  });

  it("maps printable_journals category to the Digital Journal label", () => {
    const key = getProductTypeKeyByCategory("printable_journals");
    expect(key).toBe("printable_journal");
    expect(getProductType(key).label).toBe("Digital Journal");
  });

  it("maps financial_planners category to the Financial Planner label", () => {
    const key = getProductTypeKeyByCategory("financial_planners");
    expect(key).toBe("financial_planner");
    expect(getProductType(key).label).toBe("Financial Planner");
  });

  it("maps ebooks category to the eBook label", () => {
    const key = getProductTypeKeyByCategory("ebooks");
    expect(key).toBe("ebook");
    expect(getProductType(key).label).toBe("eBook");
  });

  it("is case-insensitive on the stored category", () => {
    expect(getProductTypeKeyByCategory("AI_PROMPT_PACKS")).toBe("ai_prompt_pack");
  });

  it("returns undefined for unknown/legacy categories so the caller can fall back", () => {
    expect(getProductTypeKeyByCategory("finance")).toBeUndefined();
    expect(getProductTypeKeyByCategory("")).toBeUndefined();
    expect(getProductTypeKeyByCategory(null)).toBeUndefined();
    expect(getProductTypeKeyByCategory(undefined)).toBeUndefined();
  });
});
