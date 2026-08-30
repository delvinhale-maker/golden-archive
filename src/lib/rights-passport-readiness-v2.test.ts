import { describe, it, expect } from "bun:test";
import { computeReadinessScoreV2, type ReadinessInputV2 } from "./rights-passport-readiness-v2";

const blankPassport: ReadinessInputV2["passport"] = {
  public_professional_name: null,
  rights_contact_email: null,
  verification_level: "SELF_DECLARED",
  successor_estate_contact: null,
  effective_date: null,
  review_frequency: null,
};

const fullPassport: ReadinessInputV2["passport"] = {
  public_professional_name: "Jordan Rivers",
  rights_contact_email: "rights@example.com",
  verification_level: "DOCUMENT_SUPPORTED",
  successor_estate_contact: "estate@example.com",
  effective_date: "2026-01-01",
  review_frequency: "Annually",
};

const HIGH_RISK = ["VOICE_CLONE", "DIGITAL_REPLICA", "GENERATED_ADVERTISEMENT", "COMMERCIAL_MODEL_OUTPUT", "POSTHUMOUS_ESTATE_USE"] as const;

function allConsentsAllowed(): ReadinessInputV2["aiConsents"] {
  // 22 total use cases in the real enum; for test purposes only the count
  // and the high-risk subset matter to the scoring math.
  const others = [
    "GENERAL_AI_TRAINING", "FINE_TUNING_CUSTOM_MODEL", "EMBEDDING_RETRIEVAL", "SYNTHETIC_VOICE",
    "FACE_LIKENESS_GENERATION", "SYNTHETIC_VIDEO", "MOTION_PERFORMANCE_SIMULATION", "AVATAR_VIRTUAL_HUMAN",
    "GAME_CHARACTER", "PERSONALIZED_CONTENT", "STYLE_PERSONA_SIMULATION", "TRANSLATION_DUBBING",
    "AI_REMIX_DERIVATIVE", "PROMPT_DATASET_EXAMPLE", "BENCHMARK_EVALUATION", "SEARCH_DISCOVERY_INDEXING",
    "NONCOMMERCIAL_RESEARCH",
  ];
  return [...HIGH_RISK, ...others].map((useCase) => ({
    use_case: useCase as any,
    asset_id: null,
    permission: "PROHIBIT" as const,
  }));
}

function baseInput(overrides: Partial<ReadinessInputV2> = {}): ReadinessInputV2 {
  return {
    passport: blankPassport,
    assets: [],
    aiConsents: [],
    licenses: [],
    evidence: [],
    openFlags: [],
    ...overrides,
  };
}

describe("computeReadinessScoreV2 — blank passport", () => {
  it("caps a completely blank passport at 20", () => {
    const r = computeReadinessScoreV2(baseInput());
    expect(r.score).toBeLessThanOrEqual(20);
    expect(r.status).toBe("HIGH_RIGHTS_EXPOSURE");
  });
});

describe("computeReadinessScoreV2 — status thresholds", () => {
  it("scores 0-49 as HIGH_RIGHTS_EXPOSURE", () => {
    const r = computeReadinessScoreV2(baseInput());
    expect(r.score).toBeLessThan(50);
    expect(r.status).toBe("HIGH_RIGHTS_EXPOSURE");
  });

  it("a well-filled, fully-declared, evidenced, blocker-free passport reaches PUBLISH_READY", () => {
    const asset = { id: "a1", status: "ACTIVE" as const, control_basis: "CREATORSHIP" as const };
    const r = computeReadinessScoreV2(
      baseInput({
        passport: fullPassport,
        assets: [asset],
        aiConsents: allConsentsAllowed(),
        evidence: [{ id: "e1", asset_id: "a1", status: "VERIFIED" as const }],
        openFlags: [],
      }),
    );
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.publishBlocked).toBe(false);
    expect(r.status).toBe("PUBLISH_READY");
  });
});

describe("computeReadinessScoreV2 — publish blockers", () => {
  const readyInput = (): ReadinessInputV2 => ({
    passport: fullPassport,
    assets: [{ id: "a1", status: "ACTIVE", control_basis: "CREATORSHIP" }],
    aiConsents: allConsentsAllowed(),
    licenses: [],
    evidence: [{ id: "e1", asset_id: "a1", status: "VERIFIED" }],
    openFlags: [],
  });

  it("zero assets prevents PUBLISH_READY", () => {
    const r = computeReadinessScoreV2({ ...readyInput(), assets: [] });
    expect(r.publishBlocked).toBe(true);
    expect(r.blockers.some((b) => b.includes("No assets"))).toBe(true);
    expect(r.status).not.toBe("PUBLISH_READY");
  });

  it("undeclared high-risk AI use prevents PUBLISH_READY", () => {
    const r = computeReadinessScoreV2({ ...readyInput(), aiConsents: [] });
    expect(r.publishBlocked).toBe(true);
    expect(r.blockers.some((b) => b.includes("high-risk"))).toBe(true);
  });

  it("a CRITICAL open review flag prevents PUBLISH_READY", () => {
    const r = computeReadinessScoreV2({
      ...readyInput(),
      openFlags: [{ ruleCode: "ASSET_CONTROL_BASIS_REVIEW_REQUIRED", severity: "CRITICAL" }],
    });
    expect(r.publishBlocked).toBe(true);
    expect(r.blockers.some((b) => b.includes("CRITICAL"))).toBe(true);
  });

  it("unresolved ownership/control REVIEW_REQUIRED on an asset prevents PUBLISH_READY", () => {
    const r = computeReadinessScoreV2({
      ...readyInput(),
      assets: [{ id: "a1", status: "ACTIVE", control_basis: "REVIEW_REQUIRED" }],
    });
    expect(r.publishBlocked).toBe(true);
    expect(r.blockers.some((b) => b.toLowerCase().includes("ownership"))).toBe(true);
  });

  it("missing public rights contact prevents PUBLISH_READY", () => {
    const r = computeReadinessScoreV2({
      ...readyInput(),
      passport: { ...fullPassport, rights_contact_email: null },
    });
    expect(r.publishBlocked).toBe(true);
    expect(r.blockers.some((b) => b.toLowerCase().includes("rights contact"))).toBe(true);
  });

  it("a HIGH (not CRITICAL) open flag alone does not block publish", () => {
    const r = computeReadinessScoreV2({
      ...readyInput(),
      openFlags: [{ ruleCode: "ASSET_DISPUTED", severity: "HIGH" }],
    });
    expect(r.publishBlocked).toBe(false);
  });
});

describe("computeReadinessScoreV2 — response shape", () => {
  it("returns exactly the required top-level fields", () => {
    const r = computeReadinessScoreV2(baseInput());
    expect(r).toHaveProperty("score");
    expect(r).toHaveProperty("status");
    expect(r).toHaveProperty("dimensions");
    expect(r).toHaveProperty("primaryGap");
    expect(r).toHaveProperty("recommendedNextMove");
    expect(r).toHaveProperty("openReviewFlags");
    expect(r).toHaveProperty("publishBlocked");
    expect(r).toHaveProperty("blockers");
    expect(Array.isArray(r.dimensions)).toBe(true);
    expect(Array.isArray(r.blockers)).toBe(true);
  });

  it("returns exactly 7 weighted dimensions summing to 100", () => {
    const r = computeReadinessScoreV2(baseInput());
    expect(r.dimensions.length).toBe(7);
    const totalWeight = r.dimensions.reduce((s, d) => s + d.weight, 0);
    expect(totalWeight).toBe(100);
  });

  it("never returns a score outside [0, 100]", () => {
    const r1 = computeReadinessScoreV2(baseInput());
    expect(r1.score).toBeGreaterThanOrEqual(0);
    expect(r1.score).toBeLessThanOrEqual(100);
  });

  it("openReviewFlags reflects the length of the passed-in openFlags array", () => {
    const r = computeReadinessScoreV2(
      baseInput({
        openFlags: [
          { ruleCode: "A", severity: "MODERATE" },
          { ruleCode: "B", severity: "LOW" },
        ],
      }),
    );
    expect(r.openReviewFlags).toBe(2);
  });
});

describe("computeReadinessScoreV2 — never asserts legal ownership", () => {
  it("no dimension label or gap text claims legal verification or ownership", () => {
    const r = computeReadinessScoreV2(baseInput({ passport: fullPassport }));
    const serialized = JSON.stringify(r);
    expect(serialized).not.toMatch(/legally verified|proves? ownership|government certif/i);
  });
});
