import { describe, it, expect } from "bun:test";
import {
  confidenceBand,
  isHighImpactField,
  applyReviewOverride,
  buildFindingKey,
  dedupeFindingKeys,
  type NormalizableFinding,
} from "./rights-passport-analysis-confidence";

// rights-passport-analysis-schema.ts has a top-level `import { z } from
// "zod"`, so it cannot be imported as a value here (same constraint
// documented in rights-passport-analysis-confidence.ts's own docstring —
// zod isn't installed in this sandbox). The literal list below is checked
// against that module's HIGH_IMPACT_FIELD_KEYS via a source-level text
// comparison instead, in tests/integration/rights-passport-analysis.test.ts.
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

describe("confidenceBand", () => {
  it("bands 0.90-1.00 as HIGH", () => {
    expect(confidenceBand(0.9)).toBe("HIGH");
    expect(confidenceBand(0.95)).toBe("HIGH");
    expect(confidenceBand(1)).toBe("HIGH");
  });

  it("bands 0.70-0.89 as MODERATE", () => {
    expect(confidenceBand(0.7)).toBe("MODERATE");
    expect(confidenceBand(0.89)).toBe("MODERATE");
  });

  it("bands 0.00-0.69 as LOW", () => {
    expect(confidenceBand(0)).toBe("LOW");
    expect(confidenceBand(0.69)).toBe("LOW");
  });
});

describe("isHighImpactField — every entry in the known high-impact list is recognized", () => {
  it("recognizes every (passType, field) pair in the expected high-impact list", () => {
    for (const key of HIGH_IMPACT_FIELD_KEYS) {
      const [passType, field] = key.split("::");
      expect(isHighImpactField(passType, field)).toBe(true);
    }
  });

  it("returns false for an ordinary, non-high-impact field", () => {
    expect(isHighImpactField("DOCUMENT_STRUCTURE", "effective_date")).toBe(false);
    expect(isHighImpactField("COMMERCIAL_TERMS", "royalty")).toBe(false);
  });
});

const withSource = (overrides: Partial<NormalizableFinding> = {}): NormalizableFinding => ({
  passType: "DOCUMENT_STRUCTURE",
  field: "effective_date",
  normalizedValue: "2026-01-01",
  confidence: 0.95,
  source: {
    document_id: "11111111-1111-1111-1111-111111111111",
    page: 1,
    section: null,
    quote: "Effective January 1, 2026.",
  },
  reviewRequired: false,
  reviewReason: null,
  ...overrides,
});

describe("applyReviewOverride — no support means null/zero/review-required", () => {
  it("forces normalized_value=null, confidence=0, review_required=true when source is null", () => {
    const f = withSource({
      source: null,
      normalizedValue: "invented fact",
      confidence: 0.9,
      reviewRequired: false,
    });
    const result = applyReviewOverride(f);
    expect(result.normalizedValue).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.reviewRequired).toBe(true);
  });

  it("forces the same when source.quote is empty/whitespace-only (no real support)", () => {
    const f = withSource({
      source: { document_id: "d", page: 1, section: null, quote: "   " },
      confidence: 0.8,
    });
    const result = applyReviewOverride(f);
    expect(result.normalizedValue).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.reviewRequired).toBe(true);
  });

  it("leaves a well-supported, non-high-impact finding untouched", () => {
    const f = withSource();
    const result = applyReviewOverride(f);
    expect(result.normalizedValue).toBe("2026-01-01");
    expect(result.confidence).toBe(0.95);
    expect(result.reviewRequired).toBe(false);
  });
});

describe("applyReviewOverride — high-impact fields always forced to review_required", () => {
  it("forces review_required=true for a high-confidence AI training finding even though the model said false", () => {
    const f = withSource({
      passType: "AI_SYNTHETIC_RIGHTS",
      field: "ai_training",
      confidence: 0.99,
      reviewRequired: false,
    });
    const result = applyReviewOverride(f);
    expect(result.reviewRequired).toBe(true);
    expect(result.reviewReason).not.toBeNull();
  });

  it("forces review_required=true for ownership_language", () => {
    const f = withSource({
      passType: "RIGHTS_GRANT",
      field: "ownership_language",
      reviewRequired: false,
    });
    expect(applyReviewOverride(f).reviewRequired).toBe(true);
  });

  it("forces review_required=true for voice_cloning and digital_replica", () => {
    expect(
      applyReviewOverride(
        withSource({
          passType: "AI_SYNTHETIC_RIGHTS",
          field: "voice_cloning",
          reviewRequired: false,
        }),
      ).reviewRequired,
    ).toBe(true);
    expect(
      applyReviewOverride(
        withSource({
          passType: "AI_SYNTHETIC_RIGHTS",
          field: "digital_replica",
          reviewRequired: false,
        }),
      ).reviewRequired,
    ).toBe(true);
  });

  it("forces review_required=true for perpetual/irrevocable rights and conflict signals", () => {
    expect(
      applyReviewOverride(
        withSource({
          passType: "RISK_CONFLICT_SIGNALS",
          field: "perpetual_rights",
          reviewRequired: false,
        }),
      ).reviewRequired,
    ).toBe(true);
    expect(
      applyReviewOverride(
        withSource({
          passType: "RISK_CONFLICT_SIGNALS",
          field: "irrevocable_rights",
          reviewRequired: false,
        }),
      ).reviewRequired,
    ).toBe(true);
    expect(
      applyReviewOverride(
        withSource({
          passType: "RISK_CONFLICT_SIGNALS",
          field: "conflict_with_active_license",
          reviewRequired: false,
        }),
      ).reviewRequired,
    ).toBe(true);
  });

  it("does not force review_required on a high-impact field that already has it true — preserves the model's own reason if given", () => {
    const f = withSource({
      passType: "AI_SYNTHETIC_RIGHTS",
      field: "ai_training",
      reviewRequired: true,
      reviewReason: "Model's own reason",
    });
    const result = applyReviewOverride(f);
    expect(result.reviewReason).toBe("Model's own reason");
  });
});

describe("buildFindingKey — deterministic idempotency", () => {
  const source = {
    document_id: "doc-1",
    page: 3,
    section: "Grant of Rights",
    quote: "Licensor grants a worldwide license.",
  };

  it("produces the same key for the same pass/field/source on repeated calls", () => {
    const k1 = buildFindingKey("RIGHTS_GRANT", "licenses_granted", source);
    const k2 = buildFindingKey("RIGHTS_GRANT", "licenses_granted", source);
    expect(k1).toBe(k2);
  });

  it("produces a different key for a different field", () => {
    const k1 = buildFindingKey("RIGHTS_GRANT", "licenses_granted", source);
    const k2 = buildFindingKey("RIGHTS_GRANT", "exclusivity", source);
    expect(k1).not.toBe(k2);
  });

  it("produces a different key for a different quote (different source location)", () => {
    const k1 = buildFindingKey("RIGHTS_GRANT", "licenses_granted", source);
    const k2 = buildFindingKey("RIGHTS_GRANT", "licenses_granted", {
      ...source,
      quote: "A completely different sentence.",
    });
    expect(k1).not.toBe(k2);
  });

  it("produces a stable 'no-source' key when source is null", () => {
    const k1 = buildFindingKey("DOCUMENT_STRUCTURE", "effective_date", null);
    const k2 = buildFindingKey("DOCUMENT_STRUCTURE", "effective_date", null);
    expect(k1).toBe(k2);
    expect(k1).toContain("no-source");
  });
});

describe("dedupeFindingKeys", () => {
  it("removes exact-duplicate keys, keeping the first occurrence", () => {
    const findings = [
      { findingKey: "a", v: 1 },
      { findingKey: "b", v: 2 },
      { findingKey: "a", v: 3 },
    ];
    const result = dedupeFindingKeys(findings);
    expect(result.length).toBe(2);
    expect(result.find((f) => f.findingKey === "a")?.v).toBe(1);
  });

  it("returns an empty array unchanged", () => {
    expect(dedupeFindingKeys([])).toEqual([]);
  });
});
