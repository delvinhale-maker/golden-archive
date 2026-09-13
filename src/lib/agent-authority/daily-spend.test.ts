import { describe, expect, it } from "vitest";
import { sumPurchaseAmounts } from "./daily-spend.server";

describe("Agent Authority authoritative daily spend", () => {
  it("sums positive numeric purchase amounts from server records", () => {
    expect(sumPurchaseAmounts([{ amount: 25 }, { amount: "12.50" }, { amount: 0 }, { amount: null }])).toBe(37.5);
  });

  it("ignores invalid or negative recorded amounts", () => {
    expect(sumPurchaseAmounts([{ amount: -5 }, { amount: "not-a-number" }, { amount: Number.NaN }])).toBe(0);
  });
});
