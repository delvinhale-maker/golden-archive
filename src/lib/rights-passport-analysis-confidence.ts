/**
 * AurumVault Digital Rights Passport Generator — Round 3 confidence
 * banding, high-impact review override, and finding idempotency keys.
 *
 * Pure, dependency-free (no zod, no @supabase/supabase-js), matching the
 * established pattern in rights-passport-risk-rules.ts and
 * rights-passport-readiness-v2.ts. HIGH_IMPACT_FIELD_KEYS is duplicated
 * (not imported) from rights-passport-analysis-schema.ts for the exact same
 * reason documented there: that module has a top-level `import { z } from
 * "zod"`, which would make this file unable to load in this sandbox's test
 * runner. Keep this list in sync — the "stays in sync" test in
 * rights-passport-analysis-confidence.test.ts will catch drift.
 *
 * SAFETY: confidence is one signal about extraction quality, never legal
 * certainty. A high-impact field is ALWAYS forced review_required — no
 * confidence value, however high, skips human review for these fields.
 */

const HIGH_IMPACT_FIELD_KEYS = [
  "RIGHTS_GRANT::ownership_language",
  "RIGHTS_GRANT::assignment",
  "RIGHTS_GRANT::exclusivity",
  "RIGHTS_GRANT::sublicensing",
  "AI_SYNTHETIC_RIGHTS::ai_training",
  "AI_SYNTHETIC_RIGHTS::voice_cloning",
  "AI_SYNTHETIC_RIGHTS::digital_replica",
  "AI_SYNTHETIC_RIGHTS::posthumous_use",
  "RISK_CONFLICT_SIGNALS::perpetual_rights",
  "RISK_CONFLICT_SIGNALS::irrevocable_rights",
  "RISK_CONFLICT_SIGNALS::unlimited_sublicensing",
  "RISK_CONFLICT_SIGNALS::conflict_with_passport_defaults",
  "RISK_CONFLICT_SIGNALS::conflict_with_active_license",
  "RISK_CONFLICT_SIGNALS::governing_law_conflict",
] as const;

export type ConfidenceBand = "HIGH" | "MODERATE" | "LOW";

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.9) return "HIGH";
  if (confidence >= 0.7) return "MODERATE";
  return "LOW";
}

export function isHighImpactField(passType: string, field: string): boolean {
  return (HIGH_IMPACT_FIELD_KEYS as readonly string[]).includes(`${passType}::${field}`);
}

export type FindingSource = {
  document_id: string;
  page: number | null;
  section: string | null;
  quote: string;
} | null;

export type NormalizableFinding = {
  passType: string;
  field: string;
  normalizedValue: unknown;
  confidence: number;
  source: FindingSource;
  reviewRequired: boolean;
  reviewReason: string | null;
};

/**
 * Enforces two non-negotiable rules regardless of what the model claimed:
 *   1. No source support -> normalized_value=null, confidence=0,
 *      review_required=true (spec §6 — never invent a page/section/quote,
 *      never infer ownership as fact from thin air).
 *   2. A high-impact field is ALWAYS review_required=true (spec §7),
 *      whatever confidence the model reported.
 */
export function applyReviewOverride(finding: NormalizableFinding): NormalizableFinding {
  const hasSupport = finding.source !== null && finding.source.quote.trim().length > 0;

  if (!hasSupport) {
    return {
      ...finding,
      normalizedValue: null,
      confidence: 0,
      reviewRequired: true,
      reviewReason:
        finding.reviewReason ?? "No supporting text was found in the document for this field.",
    };
  }

  if (isHighImpactField(finding.passType, finding.field) && !finding.reviewRequired) {
    return {
      ...finding,
      reviewRequired: true,
      reviewReason:
        finding.reviewReason ??
        "This is a high-impact field (ownership, assignment, exclusivity, AI/synthetic rights, or a detected conflict) and always requires your confirmation.",
    };
  }

  return finding;
}

/** Deterministic, dependency-free string hash (FNV-1a) for idempotency keys — no crypto import needed. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Deterministic idempotency key: the same pass+field+source location always
 * produces the same key, so retrying a pass upserts findings instead of
 * duplicating them (paired with the DB's UNIQUE (analysis_run_id,
 * finding_key) constraint — see rights-passport-analysis.functions.ts).
 */
export function buildFindingKey(passType: string, field: string, source: FindingSource): string {
  const locator = source
    ? `${source.document_id}::${source.page ?? ""}::${fnv1a(source.quote)}`
    : "no-source";
  return `${passType}::${field}::${locator}`;
}

/** Removes exact-duplicate keys within a single pass's raw output (defensive against a model repeating itself). */
export function dedupeFindingKeys<T extends { findingKey: string }>(findings: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const f of findings) {
    if (seen.has(f.findingKey)) continue;
    seen.add(f.findingKey);
    out.push(f);
  }
  return out;
}
