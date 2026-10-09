import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const marketplaceSource = readFileSync("src/lib/marketplace.functions.ts", "utf8");
const productCardSource = readFileSync("src/components/marketplace/ProductCard.tsx", "utf8");

describe("canonical product links from list surfaces", () => {
  it("selects slug in the general marketplace catalog query", () => {
    expect(marketplaceSource).toContain(
      '"id,slug,title,category,subcategory,product_type,delivery_contents,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at"',
    );
  });

  it("selects slug for the homepage hero product", () => {
    expect(marketplaceSource).toContain(
      '"id,slug,title,category,price_cents,cover_url,description,seller_id,created_at"',
    );
  });

  it("selects slug for promoted picks", () => {
    expect(marketplaceSource).toContain(
      '"id,slug,title,category,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at"',
    );
  });

  it("ProductCard prefers the canonical slug for both product links", () => {
    const slugFirstLinks = productCardSource.match(/product\.slug \?\? product\.id/g) ?? [];
    expect(slugFirstLinks).toHaveLength(2);
  });
});
