/**
 * AurumVault Audiobook Studio — Phase 2 usage estimation/actualisation.
 *
 * Pure. Deliberately does NOT assume provider list prices pass straight
 * through to the creator: pricing is expressed as an explicit rate table so a
 * later billing decision is a data change, not a code assumption. The mock
 * provider always costs 0 — a mock run must never look like a real charge.
 *
 * NOTE: no Stripe/checkout/billing behaviour is touched in Phase 2. These
 * helpers only shape rows for the additive audiobook_usage table.
 */

export type UsageKind = "ESTIMATE" | "ACTUAL";

export type ProviderRate = {
  provider: string;
  model: string | null;
  /** Cost in cents per 1,000 characters, as configured for AurumVault. */
  centsPer1kChars: number;
  currency: string;
};

/**
 * Mock is explicitly free. The OpenAI entry is an INTERNAL APPROXIMATE
 * estimate derived from characters — OpenAI bills by tokens/audio, not by
 * characters, so this is never presented as a vendor invoice amount.
 */
export const AUDIOBOOK_RATES: ProviderRate[] = [
  { provider: "mock", model: null, centsPer1kChars: 0, currency: "usd" },
  { provider: "openai", model: null, centsPer1kChars: 2, currency: "usd" },
];

/** Providers whose character-based estimate is an approximation only. */
export const APPROXIMATE_ESTIMATE_PROVIDERS = new Set(["openai"]);

export function isApproximateEstimate(provider: string): boolean {
  return APPROXIMATE_ESTIMATE_PROVIDERS.has(provider);
}

export function findRate(provider: string, model: string | null): ProviderRate | null {
  return (
    AUDIOBOOK_RATES.find((r) => r.provider === provider && r.model === model) ??
    AUDIOBOOK_RATES.find((r) => r.provider === provider && r.model === null) ??
    null
  );
}

export type UsageRowInput = {
  ownerId: string;
  projectId: string | null;
  chapterId: string | null;
  jobId: string | null;
  kind: UsageKind;
  provider: string;
  model: string | null;
  characters: number;
  durationSeconds?: number | null;
};

export type UsageRow = {
  owner_id: string;
  project_id: string | null;
  chapter_id: string | null;
  job_id: string | null;
  kind: UsageKind;
  provider: string;
  model: string | null;
  characters: number;
  duration_seconds: number | null;
  cost_cents: number;
  currency: string;
  metadata: Record<string, unknown>;
};

/** Average narration pace used to estimate runtime from character count. */
export const CHARS_PER_SECOND_ESTIMATE = 15;

export function estimateDurationSeconds(characters: number): number {
  if (characters <= 0) return 0;
  return Math.round((characters / CHARS_PER_SECOND_ESTIMATE) * 100) / 100;
}

export function estimateCostCents(
  characters: number,
  provider: string,
  model: string | null,
): { costCents: number; currency: string; rateKnown: boolean } {
  const rate = findRate(provider, model);
  if (!rate) return { costCents: 0, currency: "usd", rateKnown: false };
  return {
    costCents: Math.ceil((Math.max(0, characters) / 1000) * rate.centsPer1kChars),
    currency: rate.currency,
    rateKnown: true,
  };
}

export function buildUsageRow(input: UsageRowInput): UsageRow {
  const { costCents, currency, rateKnown } = estimateCostCents(
    input.characters,
    input.provider,
    input.model,
  );
  const isMock = input.provider === "mock";
  return {
    owner_id: input.ownerId,
    project_id: input.projectId,
    chapter_id: input.chapterId,
    job_id: input.jobId,
    kind: input.kind,
    provider: input.provider,
    model: input.model,
    characters: Math.max(0, Math.round(input.characters)),
    duration_seconds:
      input.durationSeconds ?? (input.kind === "ESTIMATE" ? estimateDurationSeconds(input.characters) : null),
    cost_cents: isMock ? 0 : costCents,
    currency,
    metadata: {
      rate_known: rateKnown,
      mock: isMock,
      billable: !isMock && costCents > 0,
      // Truthfulness: for approximate providers cost_cents is AurumVault's own
      // character-based estimate, not a vendor-reported charge.
      estimate_approximate: isApproximateEstimate(input.provider),
      vendor_reported_cost: false,
    },
  };
}