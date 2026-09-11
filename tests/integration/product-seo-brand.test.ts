import { describe, expect, it } from "vitest";
import { resolveProductBrandName } from "@/lib/product-seo";

describe("product structured-data brand", () => {
  it("uses AurumVault only for AurumVault-owned inventory", () => {
    expect(resolveProductBrandName({ isAurumVaultOwned: true })).toBe("AurumVault");
  });

  it("uses a verified public creator brand for independent creator inventory", () => {
    expect(resolveProductBrandName({ creatorName: "Creator Studio", creatorVerified: true })).toBe("Creator Studio");
  });

  it("omits brand when creator identity is not verified", () => {
    expect(resolveProductBrandName({ creatorName: "Unknown", creatorVerified: false })).toBeUndefined();
  });
});
