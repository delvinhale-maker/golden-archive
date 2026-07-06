import { describe, it, expect } from "vitest";
import { parseWhatsIncluded } from "./marketplace.functions";
import { PRODUCT_TYPES } from "./product-types";

// Simulates the mapping performed in dbRowToProduct: ebooks skip the parse,
// all other product types run admin_notes.whatsIncluded -> included[].
function mapIncluded(categorySlug: string, adminNotes: string | null): string[] | undefined {
  const isEbook = categorySlug.toLowerCase() === "ebooks";
  return isEbook ? undefined : parseWhatsIncluded(adminNotes);
}

const sampleNotes = JSON.stringify({
  seriesName: null,
  edition: null,
  whatsIncluded: "Full PDF workbook\n• Bonus templates\n- Lifetime updates\n* Video walkthrough",
  keywords: [],
});

describe("parseWhatsIncluded", () => {
  it("returns undefined for null / empty / malformed / missing key", () => {
    expect(parseWhatsIncluded(null)).toBeUndefined();
    expect(parseWhatsIncluded("")).toBeUndefined();
    expect(parseWhatsIncluded("not json")).toBeUndefined();
    expect(parseWhatsIncluded(JSON.stringify({ other: "x" }))).toBeUndefined();
    expect(parseWhatsIncluded(JSON.stringify({ whatsIncluded: "" }))).toBeUndefined();
    expect(parseWhatsIncluded(JSON.stringify({ whatsIncluded: "   " }))).toBeUndefined();
  });

  it("splits newlines and bullet prefixes into clean items", () => {
    const items = parseWhatsIncluded(sampleNotes);
    expect(items).toEqual([
      "Full PDF workbook",
      "Bonus templates",
      "Lifetime updates",
      "Video walkthrough",
    ]);
  });
});

describe("dbRowToProduct included mapping", () => {
  it("skips whatsIncluded for ebooks", () => {
    expect(mapIncluded("ebooks", sampleNotes)).toBeUndefined();
  });

  it("populates included[] for every non-ebook product type", () => {
    const nonEbookSlugs = Object.values(PRODUCT_TYPES)
      .filter((t) => !t.isEbook)
      .map((t) => t.category);

    // Sanity: we cover all 12 non-ebook types
    expect(nonEbookSlugs.length).toBeGreaterThanOrEqual(12);

    for (const slug of nonEbookSlugs) {
      const items = mapIncluded(slug, sampleNotes);
      expect(items, `slug=${slug}`).toEqual([
        "Full PDF workbook",
        "Bonus templates",
        "Lifetime updates",
        "Video walkthrough",
      ]);
    }
  });

  it("non-ebook with no admin_notes returns undefined (no fake defaults)", () => {
    expect(mapIncluded("courses", null)).toBeUndefined();
    expect(mapIncluded("financial_planners", JSON.stringify({ whatsIncluded: null }))).toBeUndefined();
  });
});
