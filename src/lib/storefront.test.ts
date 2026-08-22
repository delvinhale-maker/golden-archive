import { describe, expect, it } from "vitest";
import {
  checkStorefrontSlug,
  conversionRate,
  filterOwnedProductIds,
  normalizeAccent,
  normalizeStorefrontSlug,
  safeExternalUrl,
  splitGross,
} from "./storefront";

describe("storefront slugs", () => {
  it("normalizes messy input", () => {
    expect(normalizeStorefrontSlug("  Kingdom  Mind™ Studio! ")).toBe("kingdom-mind-studio");
    expect(normalizeStorefrontSlug("--A--B--")).toBe("a-b");
  });

  it("rejects reserved platform words", () => {
    for (const reserved of ["admin", "Store", "CHECKOUT", "aurum vault"]) {
      const r = checkStorefrontSlug(reserved);
      expect(r.ok, reserved).toBe(false);
    }
  });

  it("rejects slugs that are too short", () => {
    expect(checkStorefrontSlug("ab").ok).toBe(false);
    expect(checkStorefrontSlug("!!").ok).toBe(false);
  });

  it("accepts a normal brand", () => {
    const r = checkStorefrontSlug("Golden Archive Press");
    expect(r).toEqual({ ok: true, slug: "golden-archive-press" });
  });
});

describe("safeExternalUrl", () => {
  it("blocks dangerous and non-https schemes", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>")).toBeNull();
    expect(safeExternalUrl("http://example.com")).toBeNull();
    expect(safeExternalUrl("//example.com")).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });

  it("allows absolute https urls", () => {
    expect(safeExternalUrl(" https://example.com/x ")).toBe("https://example.com/x");
  });
});

describe("filterOwnedProductIds", () => {
  it("drops products the creator does not own", () => {
    expect(filterOwnedProductIds(["a", "stolen", "b"], ["a", "b", "c"])).toEqual(["a", "b"]);
  });

  it("dedupes and caps at six", () => {
    const owned = ["1", "2", "3", "4", "5", "6", "7"];
    expect(filterOwnedProductIds([...owned, "1"], owned)).toHaveLength(6);
  });
});

describe("money and rates", () => {
  it("splits gross 85/15", () => {
    expect(splitGross(7999)).toEqual({
      grossCents: 7999,
      creatorEarningsCents: 6799,
      platformFeeCents: 1200,
    });
  });

  it("guards divide-by-zero conversion", () => {
    expect(conversionRate(3, 0)).toBe(0);
    expect(conversionRate(3, 12)).toBe(25);
  });
});

describe("accents", () => {
  it("falls back to gold for unknown values", () => {
    expect(normalizeAccent("neon")).toBe("gold");
    expect(normalizeAccent(null)).toBe("gold");
    expect(normalizeAccent("emerald")).toBe("emerald");
  });
});
