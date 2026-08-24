import { describe, it, expect } from "bun:test";
import {
  estimateDigitalProductRevenue,
  clampCalculatorInput,
  formatEstimateDollars,
} from "./revenue-calculator";

describe("estimateDigitalProductRevenue", () => {
  it("computes buyers, gross, and creator earnings for a typical scenario", () => {
    const r = estimateDigitalProductRevenue({
      audienceSize: 10_000,
      conversionRatePct: 2,
      priceCents: 2900,
    });
    expect(r.estimatedBuyers).toBe(200);
    expect(r.grossRevenueCents).toBe(580_000);
    // Default creator share matches AurumVault's real 85% split.
    expect(r.creatorEarningsCents).toBe(Math.round(580_000 * 0.85));
  });

  it("returns zero across the board for zero audience", () => {
    const r = estimateDigitalProductRevenue({
      audienceSize: 0,
      conversionRatePct: 5,
      priceCents: 1000,
    });
    expect(r.estimatedBuyers).toBe(0);
    expect(r.grossRevenueCents).toBe(0);
    expect(r.creatorEarningsCents).toBe(0);
  });

  it("returns zero for zero conversion rate", () => {
    const r = estimateDigitalProductRevenue({
      audienceSize: 50_000,
      conversionRatePct: 0,
      priceCents: 1000,
    });
    expect(r.estimatedBuyers).toBe(0);
  });

  it("respects a custom creator share percentage", () => {
    const r = estimateDigitalProductRevenue({
      audienceSize: 1000,
      conversionRatePct: 10,
      priceCents: 1000,
      creatorSharePct: 50,
    });
    expect(r.estimatedBuyers).toBe(100);
    expect(r.grossRevenueCents).toBe(100_000);
    expect(r.creatorEarningsCents).toBe(50_000);
  });

  it("never returns creator earnings greater than gross revenue", () => {
    const r = estimateDigitalProductRevenue({
      audienceSize: 5000,
      conversionRatePct: 3,
      priceCents: 4900,
      creatorSharePct: 100,
    });
    expect(r.creatorEarningsCents).toBeLessThanOrEqual(r.grossRevenueCents);
  });
});

describe("clampCalculatorInput — no fake precision, no runaway numbers", () => {
  it("clamps negative inputs to zero", () => {
    const c = clampCalculatorInput({ audienceSize: -100, conversionRatePct: -5, priceCents: -900 });
    expect(c.audienceSize).toBe(0);
    expect(c.conversionRatePct).toBe(0);
    expect(c.priceCents).toBe(0);
  });

  it("clamps conversion rate to a maximum of 100%", () => {
    const c = clampCalculatorInput({ audienceSize: 100, conversionRatePct: 500, priceCents: 100 });
    expect(c.conversionRatePct).toBe(100);
  });

  it("clamps an absurdly large audience size to a sane ceiling", () => {
    const c = clampCalculatorInput({
      audienceSize: 999_999_999_999,
      conversionRatePct: 1,
      priceCents: 100,
    });
    expect(c.audienceSize).toBe(100_000_000);
  });

  it("treats NaN/undefined-like inputs as zero rather than propagating NaN", () => {
    const c = clampCalculatorInput({
      audienceSize: Number.NaN,
      conversionRatePct: Number.NaN,
      priceCents: Number.NaN,
    });
    expect(Number.isNaN(c.audienceSize)).toBe(false);
    expect(Number.isNaN(c.conversionRatePct)).toBe(false);
    expect(Number.isNaN(c.priceCents)).toBe(false);
  });
});

describe("formatEstimateDollars", () => {
  it("formats whole dollars with thousands separators", () => {
    expect(formatEstimateDollars(123_456_78)).toBe("$123,457");
  });

  it("rounds to the nearest dollar rather than showing cents", () => {
    expect(formatEstimateDollars(1050)).toBe("$11"); // $10.50 rounds to $11
    expect(formatEstimateDollars(1049)).toBe("$10");
  });
});
