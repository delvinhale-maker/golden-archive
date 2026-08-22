import { describe, expect, it } from "vitest";
import { pctChange, summarizePeriod, type OrderLine } from "./merchandising";

const line = (o: string, amt: number, bundleId: string | null = null, isBump = false): OrderLine => ({
  orderId: o,
  amountCents: amt,
  bundleId,
  isBump,
});

describe("summarizePeriod", () => {
  it("returns nulls when there is no data", () => {
    const m = summarizePeriod([]);
    expect(m.orders).toBe(0);
    expect(m.aovCents).toBeNull();
    expect(m.bundleAttachRatePct).toBeNull();
  });

  it("computes AOV, items per order and attach rates", () => {
    const m = summarizePeriod([
      line("o1", 1000),
      line("o1", 500, null, true),
      line("o2", 800, "b1"),
      line("o2", 700, "b1"),
    ]);
    expect(m.orders).toBe(2);
    expect(m.revenueCents).toBe(3000);
    expect(m.aovCents).toBe(1500);
    expect(m.itemsPerOrder).toBe(2);
    expect(m.bundleOrders).toBe(1);
    expect(m.bundleRevenueCents).toBe(1500);
    expect(m.bundleAttachRatePct).toBe(50);
    expect(m.bumpAttachRatePct).toBe(50);
  });
});

describe("pctChange", () => {
  it("guards against divide-by-zero and missing data", () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(null, 50)).toBeNull();
    expect(pctChange(150, 100)).toBe(50);
  });
});
