/**
 * Unit tests for the deterministic product meta-description fallback.
 * Pure function, no app imports — runs standalone.
 *
 * Run: bun test tests/integration/product-fallback-description.test.ts
 */
import { describe, it, expect } from "bun:test";
import { buildFallbackProductDescription } from "@/lib/product-seo";

describe("buildFallbackProductDescription", () => {
  it("builds a description from title + category", () => {
    const desc = buildFallbackProductDescription({ title: "The Stewardship Codex", category: "eBooks" });
    expect(desc).toBe("Explore The Stewardship Codex, a eBooks digital resource available on AurumVault.");
  });

  it("distinct products with missing descriptions get distinct fallbacks", () => {
    const a = buildFallbackProductDescription({ title: "The Stewardship Codex", category: "eBooks" });
    const b = buildFallbackProductDescription({ title: "Cap Table Atlas", category: "Templates" });
    const c = buildFallbackProductDescription({ title: "Boardroom Liturgy — Audio", category: "Audio" });
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("two products in the same category but different titles still differ", () => {
    const a = buildFallbackProductDescription({ title: "Quiet Equity", category: "eBooks" });
    const b = buildFallbackProductDescription({ title: "Sovereign Mornings", category: "eBooks" });
    expect(a).not.toBe(b);
  });

  it("omits the category clause gracefully when category is missing", () => {
    const desc = buildFallbackProductDescription({ title: "Untitled Draft", category: null });
    expect(desc).toBe("Explore Untitled Draft, a digital resource available on AurumVault.");
    expect(desc).not.toContain("a  digital"); // no double space from an empty slot
  });

  it("omits the creator clause when no creatorName is given", () => {
    const desc = buildFallbackProductDescription({ title: "Any Title", category: "Finance" });
    expect(desc.toLowerCase()).not.toMatch(/\bby\s+\w/); // no "by {creator}" clause
    expect(desc).toBe("Explore Any Title, a Finance digital resource available on AurumVault.");
  });

  it("falls back to a generic line only when there is no title at all", () => {
    const desc = buildFallbackProductDescription({ title: "" });
    expect(desc).toBe("A premium digital resource available on AurumVault.");
  });

  it("includes the real creator name when a public storefront identity is given", () => {
    const desc = buildFallbackProductDescription({
      title: "Cap Table Atlas",
      category: "Templates",
      creatorName: "Steward Studio",
      isAurumVaultOwned: false,
    });
    expect(desc).toBe("Explore Cap Table Atlas, a Templates digital resource by Steward Studio, available on AurumVault.");
  });

  it("includes the creator name even without a category", () => {
    const desc = buildFallbackProductDescription({
      title: "Untitled Draft",
      creatorName: "Steward Studio",
      isAurumVaultOwned: false,
    });
    expect(desc).toBe("Explore Untitled Draft, a digital resource by Steward Studio, available on AurumVault.");
  });

  it("never credits AurumVault itself as if it were a third-party creator", () => {
    const desc = buildFallbackProductDescription({
      title: "Kingdom Mind",
      category: "eBooks",
      creatorName: "AurumVault",
      isAurumVaultOwned: true,
    });
    expect(desc.toLowerCase()).not.toMatch(/\bby\s+aurumvault\b/);
    expect(desc).toBe("Explore Kingdom Mind, a eBooks digital resource available on AurumVault.");
  });

  it("omits the creator clause when isAurumVaultOwned is true even if a name is passed", () => {
    const desc = buildFallbackProductDescription({
      title: "Kingdom Mind",
      creatorName: "Someone",
      isAurumVaultOwned: true,
    });
    expect(desc.toLowerCase()).not.toContain("by someone");
  });

  it("distinct real creators produce distinct fallbacks for the same title/category", () => {
    const a = buildFallbackProductDescription({ title: "Cap Table Atlas", category: "Templates", creatorName: "Steward Studio" });
    const b = buildFallbackProductDescription({ title: "Cap Table Atlas", category: "Templates", creatorName: "Founder OS" });
    expect(a).not.toBe(b);
  });
});
