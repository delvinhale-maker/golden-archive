import { describe, it, expect } from "vitest";
import {
  computeVerificationChecklist,
  VERIFY_HIGH_RISK_AI_USE_CASES,
  type VerificationInput,
} from "./rights-passport-verify";

const blankPassport: VerificationInput["passport"] = {
  public_professional_name: null,
  rights_contact_email: null,
  verification_level: "SELF_DECLARED",
  successor_estate_contact: null,
  effective_date: null,
  review_frequency: null,
};

const fullPassport: VerificationInput["passport"] = {
  public_professional_name: "Jordan Rivers",
  rights_contact_email: "rights@example.com",
  verification_level: "DOCUMENT_SUPPORTED",
  successor_estate_contact: "estate@example.com",
  effective_date: "2026-01-01",
  review_frequency: "Annually",
};

function allSixDeclared(): VerificationInput["aiConsents"] {
  return VERIFY_HIGH_RISK_AI_USE_CASES.map((useCase) => ({
    use_case: useCase as any,
    asset_id: null,
    permission: "PROHIBIT" as const,
  }));
}

function baseInput(overrides: Partial<VerificationInput> = {}): VerificationInput {
  return {
    passport: blankPassport,
    assets: [],
    aiConsents: [],
    licenses: [],
    evidence: [],
    openFlags: [],
    version: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeVerificationChecklist — high-risk AI list is Round 4's own 6 items", () => {
  it("VERIFY_HIGH_RISK_AI_USE_CASES has exactly 6 entries including GENERAL_AI_TRAINING", () => {
    expect(VERIFY_HIGH_RISK_AI_USE_CASES.length).toBe(6);
    expect(VERIFY_HIGH_RISK_AI_USE_CASES).toContain("GENERAL_AI_TRAINING");
    expect(VERIFY_HIGH_RISK_AI_USE_CASES).toContain("VOICE_CLONE");
    expect(VERIFY_HIGH_RISK_AI_USE_CASES).toContain("DIGITAL_REPLICA");
    expect(VERIFY_HIGH_RISK_AI_USE_CASES).toContain("GENERATED_ADVERTISEMENT");
    expect(VERIFY_HIGH_RISK_AI_USE_CASES).toContain("COMMERCIAL_MODEL_OUTPUT");
    expect(VERIFY_HIGH_RISK_AI_USE_CASES).toContain("POSTHUMOUS_ESTATE_USE");
  });

  it("blocks when GENERAL_AI_TRAINING alone is undeclared, even though it's outside Round 2/3's 5-item list", () => {
    const fiveOfSix = VERIFY_HIGH_RISK_AI_USE_CASES.filter((u) => u !== "GENERAL_AI_TRAINING").map(
      (useCase) => ({
        use_case: useCase as any,
        asset_id: null,
        permission: "PROHIBIT" as const,
      }),
    );
    const result = computeVerificationChecklist(
      baseInput({
        passport: fullPassport,
        assets: [{ id: "a1", status: "ACTIVE", control_basis: "CREATORSHIP" }],
        aiConsents: fiveOfSix,
      }),
    );
    const check = result.checks.find((c) => c.id === "ai_consent_high_risk_declared");
    expect(check?.passed).toBe(false);
    expect(check?.detail).toContain("GENERAL AI TRAINING");
    expect(result.readyToPublish).toBe(false);
  });

  it("passes the AI consent check once all 6 are declared", () => {
    const result = computeVerificationChecklist(
      baseInput({
        passport: fullPassport,
        assets: [{ id: "a1", status: "ACTIVE", control_basis: "CREATORSHIP" }],
        aiConsents: allSixDeclared(),
      }),
    );
    expect(result.checks.find((c) => c.id === "ai_consent_high_risk_declared")?.passed).toBe(true);
  });
});

describe("computeVerificationChecklist — readyToPublish gating", () => {
  const readyBase = (): VerificationInput =>
    baseInput({
      passport: fullPassport,
      assets: [{ id: "a1", status: "ACTIVE", control_basis: "CREATORSHIP" }],
      aiConsents: allSixDeclared(),
      evidence: [{ id: "e1", asset_id: "a1", status: "VERIFIED" }],
    });

  it("is ready to publish when nothing blocks and score is high", () => {
    const result = computeVerificationChecklist(readyBase());
    expect(result.readyToPublish).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("does not require score === 100 to be ready", () => {
    const result = computeVerificationChecklist(readyBase());
    expect(result.score).toBeLessThan(100);
    expect(result.readyToPublish).toBe(true);
  });

  it("blockers override the score — an unresolved asset control issue blocks publish even with a high score otherwise", () => {
    const result = computeVerificationChecklist({
      ...readyBase(),
      assets: [{ id: "a1", status: "ACTIVE", control_basis: "REVIEW_REQUIRED" }],
    });
    expect(result.readyToPublish).toBe(false);
    expect(result.checks.find((c) => c.id === "assets_no_unresolved_control")?.passed).toBe(false);
  });

  it("blocks when zero assets are registered", () => {
    const result = computeVerificationChecklist({ ...readyBase(), assets: [] });
    expect(result.readyToPublish).toBe(false);
    expect(result.checks.find((c) => c.id === "assets_at_least_one")?.passed).toBe(false);
  });

  it("blocks when the rights contact is missing", () => {
    const result = computeVerificationChecklist({
      ...readyBase(),
      passport: { ...fullPassport, rights_contact_email: null },
    });
    expect(result.readyToPublish).toBe(false);
  });

  it("blocks on an open CRITICAL review flag", () => {
    const result = computeVerificationChecklist({
      ...readyBase(),
      openFlags: [{ ruleCode: "SOME_RULE", severity: "CRITICAL" }],
    });
    expect(result.readyToPublish).toBe(false);
    expect(result.checks.find((c) => c.id === "licenses_no_critical_conflict")?.passed).toBe(false);
  });

  it("blocks on an open LICENSE_EXPIRED_STILL_ACTIVE flag", () => {
    const result = computeVerificationChecklist({
      ...readyBase(),
      openFlags: [{ ruleCode: "LICENSE_EXPIRED_STILL_ACTIVE", severity: "HIGH" }],
    });
    expect(result.readyToPublish).toBe(false);
    expect(result.checks.find((c) => c.id === "licenses_no_expired_active")?.passed).toBe(false);
  });

  it("blocks on an open LICENSE_COMPETING_EXCLUSIVE flag", () => {
    const result = computeVerificationChecklist({
      ...readyBase(),
      openFlags: [{ ruleCode: "LICENSE_COMPETING_EXCLUSIVE", severity: "HIGH" }],
    });
    expect(result.readyToPublish).toBe(false);
    expect(
      result.checks.find((c) => c.id === "licenses_no_unreviewed_exclusive_conflict")?.passed,
    ).toBe(false);
  });

  it("a MODERATE/LOW severity flag unrelated to license rule codes does not block publish", () => {
    const result = computeVerificationChecklist({
      ...readyBase(),
      openFlags: [{ ruleCode: "ASSET_MISSING_EVIDENCE", severity: "MODERATE" }],
    });
    expect(result.readyToPublish).toBe(true);
  });

  it("jurisdiction status is never a blocking check, regardless of passport data", () => {
    const result = computeVerificationChecklist(readyBase());
    const check = result.checks.find((c) => c.id === "identity_jurisdiction");
    expect(check?.passed).toBe(true);
    expect(check?.blocking).toBe(false);
  });

  it("missing successor/estate contact never blocks publish (informational only)", () => {
    const result = computeVerificationChecklist({
      ...readyBase(),
      passport: { ...fullPassport, successor_estate_contact: null },
    });
    expect(result.checks.find((c) => c.id === "legacy_successor_reviewed")?.blocking).toBe(false);
    expect(result.readyToPublish).toBe(true);
  });
});

describe("computeVerificationChecklist — PRIVACY category", () => {
  it("always includes a PRIVACY check that passes by construction (not per-passport derived)", () => {
    const result = computeVerificationChecklist(baseInput());
    const privacyCheck = result.checks.find((c) => c.category === "PRIVACY");
    expect(privacyCheck).toBeDefined();
    expect(privacyCheck?.passed).toBe(true);
    expect(privacyCheck?.blocking).toBe(false);
  });
});

describe("computeVerificationChecklist — response shape", () => {
  it("returns version and lastUpdated passthrough fields", () => {
    const result = computeVerificationChecklist(
      baseInput({ version: 4, updatedAt: "2026-06-01T00:00:00.000Z" }),
    );
    expect(result.version).toBe(4);
    expect(result.lastUpdated).toBe("2026-06-01T00:00:00.000Z");
  });

  it("every check has a category from the 8 required sections", () => {
    const result = computeVerificationChecklist(baseInput());
    const categories = new Set(result.checks.map((c) => c.category));
    for (const cat of [
      "IDENTITY",
      "ASSETS",
      "AI_CONSENT",
      "LICENSES",
      "EVIDENCE",
      "VERSION",
      "LEGACY",
      "PRIVACY",
    ]) {
      expect(categories.has(cat as any)).toBe(true);
    }
  });
});
