import { describe, expect, it } from "vitest";
import { allocateBundlePrices, computeBundleTotals } from "./bundles";

describe("allocateBundlePrices", () => {
  it("sums exactly to the charged total", () => {
    const cases: [number, number[]][] = [
      [2999, [999, 999, 1499]],
      [4500, [1799, 1799, 1999]],
      [1, [999]],
      [777, [100, 200, 300, 400, 500]],
      [10000, [1, 1, 1]],
    ];
    for (const [total, prices] of cases) {
      const alloc = allocateBundlePrices(total, prices);
      expect(alloc.reduce((a, b) => a + b, 0)).toBe(total);
      expect(alloc.length).toBe(prices.length);
    }
  });

  it("keeps allocation proportional to list price", () => {
    const alloc = allocateBundlePrices(3000, [1000, 2000]);
    expect(alloc[0]).toBeLessThan(alloc[1]!);
    expect(alloc[0]! + alloc[1]!).toBe(3000);
  });

  it("never allocates a zero-cent line when total covers every line", () => {
    const alloc = allocateBundlePrices(500, [10000, 1, 1]);
    expect(alloc.every((c) => c >= 1)).toBe(true);
    expect(alloc.reduce((a, b) => a + b, 0)).toBe(500);
  });

  it("handles equal prices with an indivisible total", () => {
    const alloc = allocateBundlePrices(1000, [500, 500, 500]);
    expect(alloc.reduce((a, b) => a + b, 0)).toBe(1000);
  });
});

describe("computeBundleTotals", () => {
  it("computes savings and percentage", () => {
    const t = computeBundleTotals(2500, [999, 999, 1499]);
    expect(t.individualValueCents).toBe(3497);
    expect(t.savingsCents).toBe(997);
    expect(t.savingsPct).toBe(29);
    expect(t.needsReview).toBe(false);
  });

  it("suppresses savings when the bundle is not cheaper", () => {
    const t = computeBundleTotals(4000, [999, 999, 1499]);
    expect(t.savingsCents).toBe(0);
    expect(t.savingsPct).toBe(0);
    expect(t.needsReview).toBe(true);
  });
});
