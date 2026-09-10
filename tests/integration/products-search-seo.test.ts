import { describe, expect, it } from "vitest";
import { productsSearchSeo } from "@/lib/products-search-seo";

describe("products search SEO", () => {
  it("indexes the unfiltered catalog", () => {
    expect(productsSearchSeo({})).toEqual({
      robots: "index, follow",
      canonical: "https://www.aurumvault.store/products",
    });
  });

  it("noindexes faceted URLs", () => {
    expect(productsSearchSeo({ q: "planner" }).robots).toBe("noindex, follow");
    expect(productsSearchSeo({ sort: "newest" }).robots).toBe("noindex, follow");
    expect(productsSearchSeo({ page: 2 }).robots).toBe("noindex, follow");
  });

  it("points supported category filters to clean landing pages", () => {
    expect(productsSearchSeo({ category: "eBooks" }).canonical).toBe(
      "https://www.aurumvault.store/ebooks",
    );
    expect(productsSearchSeo({ category: "Business Systems" }).canonical).toBe(
      "https://www.aurumvault.store/business-systems",
    );
  });
});
