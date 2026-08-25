import { describe, it, expect } from "vitest";
import { deliverySummary, productBadges } from "@/lib/taxonomy";

/**
 * Public product page contract for a complete digital system that ships a ZIP
 * bundle plus an interactive PDF and an XLSX decision engine.
 */
const exampleProduct = {
  product_type: "complete_digital_system",
  category: "Business Systems",
  subcategory: "Interactive Decision Tools",
  delivery_contents: [
    "PDF",
    "XLSX",
    "ZIP",
    "Interactive PDF",
    "Decision Engine",
    "Live Tool Included",
    "Templates",
  ],
};

describe("public product page taxonomy display", () => {
  it("shows all three premium badges", () => {
    const badges = productBadges(exampleProduct);
    expect(badges).toContain("Complete Digital System");
    expect(badges).toContain("Interactive Decision Tool");
    expect(badges).toContain("Live Tools Included");
    expect(badges.length).toBeLessThanOrEqual(3);
  });

  it("indicates PDF + XLSX + ZIP formats, never storage paths", () => {
    const line = deliverySummary(exampleProduct.delivery_contents);
    expect(line).toBe("PDF + XLSX + ZIP");
    expect(line).not.toMatch(/\//);
    expect(line).not.toMatch(/\.zip|product-files|storage/i);
  });

  it("keeps real formats ahead of descriptive extras", () => {
    expect(deliverySummary(["Templates", "Sample Data", "ZIP", "PDF"])).toBe(
      "PDF + ZIP + Templates",
    );
  });

  it("badges a decision engine even without the subcategory set", () => {
    expect(
      productBadges({
        product_type: "complete_digital_system",
        category: "Business Systems",
        delivery_contents: ["ZIP", "Decision Engine"],
      }),
    ).toEqual(["Complete Digital System", "Interactive Decision Tool"]);
  });

  it("stays quiet when a product declares no delivery contents", () => {
    expect(deliverySummary([])).toBe("");
    expect(
      productBadges({ product_type: "ebook", category: "eBooks", delivery_contents: [] }),
    ).toEqual(["eBook"]);
  });
});
