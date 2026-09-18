import { describe, expect, it } from "vitest";
import {
  canonicalProductSegment,
  shouldRedirectProductRequest,
} from "@/lib/product-slug-redirect";

describe("canonical product segments", () => {
  const product = {
    id: "22945d35-29d7-4286-9362-5e348d47f938",
    slug: "digital-rights-passport",
  };

  it("prefers a clean product slug", () => {
    expect(canonicalProductSegment(product)).toBe("digital-rights-passport");
  });

  it("redirects UUID and historical requests but not the canonical slug", () => {
    const canonical = canonicalProductSegment(product);
    expect(shouldRedirectProductRequest(product.id, canonical)).toBe(true);
    expect(shouldRedirectProductRequest("digital", canonical)).toBe(true);
    expect(shouldRedirectProductRequest("digital-rights-passport", canonical)).toBe(false);
  });

  it("falls back to id when a product has no slug", () => {
    expect(canonicalProductSegment({ id: "abc", slug: null })).toBe("abc");
  });
});
