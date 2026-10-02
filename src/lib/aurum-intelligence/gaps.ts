import type { MarketplaceGapSignal, MerchantSignal } from "./contracts";

export function scoreGap(signal: MarketplaceGapSignal): number {
  if (signal.requestCount <= 0) return 0;
  const noResultRate = signal.noResultCount / signal.requestCount;
  const weakResultRate = signal.lowConfidenceCount / signal.requestCount;
  const conversionRate = signal.conversionCount / signal.requestCount;
  const scarcity = signal.resultCount === 0 ? 1 : 1 / (1 + signal.resultCount);
  const weightedScore = noResultRate * 60 + weakResultRate * 20 + scarcity * 15 + (1 - conversionRate) * 5;
  return Math.round(Math.min(100, weightedScore) * 100) / 100;
}

export function toMerchantSignal(signal: MarketplaceGapSignal): MerchantSignal {
  const demandScore = scoreGap(signal);
  const kind: MerchantSignal["kind"] =
    signal.resultCount === 0 ? "missing_product" :
    signal.noResultCount / Math.max(signal.requestCount, 1) >= 0.35 ? "weak_category" :
    "emerging_demand";
  return {
    kind,
    title: signal.objectiveKey,
    summary: `${signal.requestCount} consented requests; ${signal.noResultCount} returned no qualifying result and ${signal.resultCount} marketplace products currently map to this intent.`,
    demandScore,
    evidence: {
      requestCount: signal.requestCount,
      resultCount: signal.resultCount,
      noResultCount: signal.noResultCount,
      lowConfidenceCount: signal.lowConfidenceCount,
      conversionCount: signal.conversionCount,
    },
    generatedAt: new Date().toISOString(),
  };
}
