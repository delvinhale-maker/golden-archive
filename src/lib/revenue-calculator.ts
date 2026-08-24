/**
 * Digital Product Revenue Calculator — pure, dependency-free estimation
 * logic. Deliberately simple: audience size × conversion rate = buyers,
 * buyers × price = gross, gross × creator share = earnings. No fake
 * precision, no guaranteed-outcome language — every caller must present
 * these as estimates, never as a promise.
 */

import { CREATOR_SHARE } from "@/lib/storefront";

export type RevenueCalculatorInput = {
  audienceSize: number;
  conversionRatePct: number;
  priceCents: number;
  creatorSharePct?: number;
};

export type RevenueCalculatorResult = {
  estimatedBuyers: number;
  grossRevenueCents: number;
  creatorEarningsCents: number;
};

const MAX_AUDIENCE_SIZE = 100_000_000;
const MAX_CONVERSION_RATE_PCT = 100;
const MAX_PRICE_CENTS = 100_000_00; // $100,000 — a generous, still-sane ceiling

export function clampCalculatorInput(input: RevenueCalculatorInput): RevenueCalculatorInput {
  return {
    audienceSize: Math.max(0, Math.min(MAX_AUDIENCE_SIZE, Math.round(input.audienceSize || 0))),
    conversionRatePct: Math.max(0, Math.min(MAX_CONVERSION_RATE_PCT, input.conversionRatePct || 0)),
    priceCents: Math.max(0, Math.min(MAX_PRICE_CENTS, Math.round(input.priceCents || 0))),
    creatorSharePct:
      input.creatorSharePct === undefined
        ? undefined
        : Math.max(0, Math.min(100, input.creatorSharePct)),
  };
}

export function estimateDigitalProductRevenue(
  rawInput: RevenueCalculatorInput,
): RevenueCalculatorResult {
  const input = clampCalculatorInput(rawInput);
  const creatorShare = (input.creatorSharePct ?? CREATOR_SHARE * 100) / 100;

  const estimatedBuyers = Math.round((input.audienceSize * input.conversionRatePct) / 100);
  const grossRevenueCents = estimatedBuyers * input.priceCents;
  const creatorEarningsCents = Math.round(grossRevenueCents * creatorShare);

  return { estimatedBuyers, grossRevenueCents, creatorEarningsCents };
}

/** Formats cents as a whole-dollar string for display — no fake precision below the dollar. */
export function formatEstimateDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}
