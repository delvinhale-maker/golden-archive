import { describe, it, expect } from "bun:test";
import { evaluateRiskRules, type RiskRuleInput } from "./rights-passport-risk-rules";

const emptyPassport: RiskRuleInput["passport"] = {
  status: "DRAFT",
  public_professional_name: null,
  rights_contact_email: null,
  verification_level: "SELF_DECLARED",
  effective_date: null,
  successor_estate_contact: null,
  review_frequency: null,
};

const fullPassport: RiskRuleInput["passport"] = {
  status: "ACTIVE",
  public_professional_name: "Jordan Rivers",
  rights_contact_email: "rights@example.com",
  verification_level: "DOCUMENT_SUPPORTED",
  effective_date: "2026-01-01",
  successor_estate_contact: "estate@example.com",
  review_frequency: "Annually",
};

function baseInput(overrides: Partial<RiskRuleInput> = {}): RiskRuleInput {
  return {
    passport: emptyPassport,
    assets: [],
    aiConsents: [],
    licenses: [],
    evidence: [],
    ...overrides,
  };
}

describe("evaluateRiskRules — identity", () => {
  it("flags missing name and rights contact on a blank passport", () => {
    const flags = evaluateRiskRules(baseInput());
    expect(flags.some((f) => f.ruleCode === "IDENTITY_MISSING_NAME")).toBe(true);
    expect(flags.some((f) => f.ruleCode === "IDENTITY_MISSING_RIGHTS_CONTACT")).toBe(true);
  });

  it("does not flag identity fields when they're filled in", () => {
    const flags = evaluateRiskRules(baseInput({ passport: fullPassport, assets: [asset()] }));
    expect(flags.some((f) => f.ruleCode === "IDENTITY_MISSING_NAME")).toBe(false);
    expect(flags.some((f) => f.ruleCode === "IDENTITY_MISSING_RIGHTS_CONTACT")).toBe(false);
  });
});

function asset(
  overrides: Partial<RiskRuleInput["assets"][number]> = {},
): RiskRuleInput["assets"][number] {
  return {
    id: "asset-1",
    name: "Test Asset",
    status: "ACTIVE",
    control_basis: "CREATORSHIP",
    default_ai_policy: "REVIEW_REQUIRED",
    default_license_policy: null,
    is_public: false,
    ...overrides,
  };
}

describe("evaluateRiskRules — assets", () => {
  it("flags zero registered assets", () => {
    const flags = evaluateRiskRules(baseInput());
    expect(flags.some((f) => f.ruleCode === "ASSETS_ZERO_REGISTERED")).toBe(true);
  });

  it("flags a disputed asset", () => {
    const flags = evaluateRiskRules(baseInput({ assets: [asset({ status: "DISPUTED" })] }));
    expect(flags.some((f) => f.ruleCode === "ASSET_DISPUTED")).toBe(true);
  });

  it("flags REVIEW_REQUIRED control basis as CRITICAL — unresolved ownership", () => {
    const flags = evaluateRiskRules(
      baseInput({ assets: [asset({ control_basis: "REVIEW_REQUIRED" })] }),
    );
    const flag = flags.find((f) => f.ruleCode === "ASSET_CONTROL_BASIS_REVIEW_REQUIRED");
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe("CRITICAL");
  });

  it("flags an asset with no evidence", () => {
    const flags = evaluateRiskRules(baseInput({ assets: [asset()] }));
    expect(flags.some((f) => f.ruleCode === "ASSET_MISSING_EVIDENCE")).toBe(true);
  });

  it("does not flag missing evidence once an evidence row exists for that asset", () => {
    const flags = evaluateRiskRules(
      baseInput({
        assets: [asset()],
        evidence: [
          { id: "e1", asset_id: "asset-1", evidence_type: "SOURCE_FILE", status: "SELF_DECLARED" },
        ],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "ASSET_MISSING_EVIDENCE")).toBe(false);
  });

  it("ignores archived assets for the zero-assets and missing-evidence checks", () => {
    const flags = evaluateRiskRules(baseInput({ assets: [asset({ status: "ARCHIVED" })] }));
    expect(flags.some((f) => f.ruleCode === "ASSETS_ZERO_REGISTERED")).toBe(true);
    expect(flags.some((f) => f.ruleCode === "ASSET_MISSING_EVIDENCE")).toBe(false);
  });
});

describe("evaluateRiskRules — AI consent", () => {
  it("flags every undeclared high-risk use case on a passport with no consents", () => {
    const flags = evaluateRiskRules(baseInput());
    const highRiskFlags = flags.filter((f) => f.ruleCode === "AI_HIGH_RISK_USE_NOT_DECLARED");
    expect(highRiskFlags.length).toBe(5); // VOICE_CLONE, DIGITAL_REPLICA, GENERATED_ADVERTISEMENT, COMMERCIAL_MODEL_OUTPUT, POSTHUMOUS_ESTATE_USE
  });

  it("does not flag a high-risk use case once it has any declared permission", () => {
    const flags = evaluateRiskRules(
      baseInput({
        aiConsents: [
          {
            id: "c1",
            asset_id: null,
            use_case: "VOICE_CLONE",
            permission: "PROHIBIT",
            term: null,
            revocation_rule: null,
          },
        ],
      }),
    );
    const voiceCloneFlags = flags.filter(
      (f) => f.ruleCode === "AI_HIGH_RISK_USE_NOT_DECLARED" && f.evidenceContext === "VOICE_CLONE",
    );
    expect(voiceCloneFlags.length).toBe(0);
  });

  it("flags a REVIEW_REQUIRED consent permission", () => {
    const flags = evaluateRiskRules(
      baseInput({
        aiConsents: [
          {
            id: "c1",
            asset_id: null,
            use_case: "GENERAL_AI_TRAINING",
            permission: "REVIEW_REQUIRED",
            term: null,
            revocation_rule: null,
          },
        ],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "AI_PERMISSION_REVIEW_REQUIRED")).toBe(true);
  });

  it("flags DIGITAL_REPLICA/VOICE_CLONE allowed without documented term or revocation rule", () => {
    const flags = evaluateRiskRules(
      baseInput({
        aiConsents: [
          {
            id: "c1",
            asset_id: null,
            use_case: "DIGITAL_REPLICA",
            permission: "ALLOW",
            term: null,
            revocation_rule: null,
          },
        ],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "AI_HIGH_RISK_ALLOWED_WITHOUT_TERMS")).toBe(true);
  });

  it("does not flag a high-risk allow when terms are documented", () => {
    const flags = evaluateRiskRules(
      baseInput({
        aiConsents: [
          {
            id: "c1",
            asset_id: null,
            use_case: "DIGITAL_REPLICA",
            permission: "ALLOW",
            term: "1 year",
            revocation_rule: "30 days notice",
          },
        ],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "AI_HIGH_RISK_ALLOWED_WITHOUT_TERMS")).toBe(false);
  });

  it("does not flag a non-high-risk use case ALLOW without terms", () => {
    const flags = evaluateRiskRules(
      baseInput({
        aiConsents: [
          {
            id: "c1",
            asset_id: null,
            use_case: "TRANSLATION_DUBBING",
            permission: "ALLOW",
            term: null,
            revocation_rule: null,
          },
        ],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "AI_HIGH_RISK_ALLOWED_WITHOUT_TERMS")).toBe(false);
  });
});

function license(
  overrides: Partial<RiskRuleInput["licenses"][number]> = {},
): RiskRuleInput["licenses"][number] {
  return {
    id: "lic-1",
    asset_id: "asset-1",
    status: "ACTIVE",
    end_date: null,
    is_exclusive: false,
    ai_synthetic_rights_included: false,
    controlling_document_reference: "contract.pdf",
    ...overrides,
  };
}

describe("evaluateRiskRules — licenses", () => {
  it("flags an active exclusive license", () => {
    const flags = evaluateRiskRules(
      baseInput({ assets: [asset()], licenses: [license({ is_exclusive: true })] }),
    );
    expect(flags.some((f) => f.ruleCode === "LICENSE_ACTIVE_EXCLUSIVE")).toBe(true);
  });

  it("flags competing exclusive licenses on the same asset (Round 3.5: conflict-safe application)", () => {
    const flags = evaluateRiskRules(
      baseInput({
        assets: [asset()],
        licenses: [
          license({ id: "lic-1", is_exclusive: true, status: "ACTIVE" }),
          license({ id: "lic-2", is_exclusive: true, status: "PENDING" }),
        ],
      }),
    );
    const competing = flags.filter((f) => f.ruleCode === "LICENSE_COMPETING_EXCLUSIVE");
    expect(competing.length).toBe(2);
    expect(competing.map((f) => f.entityId).sort()).toEqual(["lic-1", "lic-2"]);
  });

  it("does not flag a single exclusive license as competing", () => {
    const flags = evaluateRiskRules(
      baseInput({ assets: [asset()], licenses: [license({ is_exclusive: true })] }),
    );
    expect(flags.some((f) => f.ruleCode === "LICENSE_COMPETING_EXCLUSIVE")).toBe(false);
  });

  it("does not flag two exclusive licenses on DIFFERENT assets as competing", () => {
    const flags = evaluateRiskRules(
      baseInput({
        assets: [asset({ id: "asset-1" }), asset({ id: "asset-2", name: "Second Asset" })],
        licenses: [
          license({ id: "lic-1", asset_id: "asset-1", is_exclusive: true }),
          license({ id: "lic-2", asset_id: "asset-2", is_exclusive: true }),
        ],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "LICENSE_COMPETING_EXCLUSIVE")).toBe(false);
  });

  it("does not flag two exclusive licenses on the same asset when one is EXPIRED/REVOKED (not live)", () => {
    const flags = evaluateRiskRules(
      baseInput({
        assets: [asset()],
        licenses: [
          license({ id: "lic-1", is_exclusive: true, status: "ACTIVE" }),
          license({ id: "lic-2", is_exclusive: true, status: "REVOKED" }),
        ],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "LICENSE_COMPETING_EXCLUSIVE")).toBe(false);
  });

  it("flags an expired-but-still-active license", () => {
    const flags = evaluateRiskRules(
      baseInput({ assets: [asset()], licenses: [license({ end_date: "2020-01-01" })] }),
    );
    expect(flags.some((f) => f.ruleCode === "LICENSE_EXPIRED_STILL_ACTIVE")).toBe(true);
  });

  it("does not flag expiration for a future end date", () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const flags = evaluateRiskRules(
      baseInput({ assets: [asset()], licenses: [license({ end_date: future })] }),
    );
    expect(flags.some((f) => f.ruleCode === "LICENSE_EXPIRED_STILL_ACTIVE")).toBe(false);
  });

  it("does not flag expiration for a non-ACTIVE license even with a past end date", () => {
    const flags = evaluateRiskRules(
      baseInput({
        assets: [asset()],
        licenses: [license({ status: "EXPIRED", end_date: "2020-01-01" })],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "LICENSE_EXPIRED_STILL_ACTIVE")).toBe(false);
  });

  it("flags unknown AI/synthetic rights (null)", () => {
    const flags = evaluateRiskRules(
      baseInput({ assets: [asset()], licenses: [license({ ai_synthetic_rights_included: null })] }),
    );
    expect(flags.some((f) => f.ruleCode === "LICENSE_AI_RIGHTS_UNKNOWN")).toBe(true);
  });

  it("flags a missing controlling document reference", () => {
    const flags = evaluateRiskRules(
      baseInput({
        assets: [asset()],
        licenses: [license({ controlling_document_reference: null })],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "LICENSE_MISSING_CONTROLLING_DOCUMENT")).toBe(true);
  });

  it("flags asset default AI policy PROHIBIT conflicting with an active license granting AI rights", () => {
    const flags = evaluateRiskRules(
      baseInput({
        assets: [asset({ default_ai_policy: "PROHIBIT" })],
        licenses: [license({ ai_synthetic_rights_included: true, status: "ACTIVE" })],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "LICENSE_CONFLICTS_ASSET_AI_POLICY")).toBe(true);
  });

  it("does not flag the AI-policy conflict when the asset's default policy allows it", () => {
    const flags = evaluateRiskRules(
      baseInput({
        assets: [asset({ default_ai_policy: "ALLOW" })],
        licenses: [license({ ai_synthetic_rights_included: true, status: "ACTIVE" })],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "LICENSE_CONFLICTS_ASSET_AI_POLICY")).toBe(false);
  });

  it("flags default license policy 'contact for license' conflicting with an existing exclusive license", () => {
    const flags = evaluateRiskRules(
      baseInput({
        assets: [asset({ default_license_policy: "Contact for license before use" })],
        licenses: [license({ is_exclusive: true, status: "ACTIVE" })],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "LICENSE_CONFLICTS_ASSET_DEFAULT_POLICY")).toBe(true);
  });

  it("never marks a license legally invalid — no field/flag asserts invalidity, only REVIEW_REQUIRED-style flags", () => {
    const flags = evaluateRiskRules(
      baseInput({ assets: [asset()], licenses: [license({ end_date: "2020-01-01" })] }),
    );
    const serialized = JSON.stringify(flags);
    expect(serialized).not.toMatch(/legally invalid|void\b|unenforceable/i);
  });
});

describe("evaluateRiskRules — evidence", () => {
  it("flags disputed evidence", () => {
    const flags = evaluateRiskRules(
      baseInput({
        evidence: [{ id: "e1", asset_id: "a1", evidence_type: "CONTRACT", status: "DISPUTED" }],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "EVIDENCE_DISPUTED")).toBe(true);
  });

  it("flags expired evidence", () => {
    const flags = evaluateRiskRules(
      baseInput({
        evidence: [{ id: "e1", asset_id: "a1", evidence_type: "CONTRACT", status: "EXPIRED" }],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "EVIDENCE_EXPIRED")).toBe(true);
  });

  it("flags identity-document evidence attached to a public asset", () => {
    const flags = evaluateRiskRules(
      baseInput({
        assets: [asset({ id: "asset-1", is_public: true })],
        evidence: [
          {
            id: "e1",
            asset_id: "asset-1",
            evidence_type: "IDENTITY_DOCUMENT",
            status: "SELF_DECLARED",
          },
        ],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "EVIDENCE_IDENTITY_DOCUMENT_ON_PUBLIC_ASSET")).toBe(
      true,
    );
  });

  it("does not flag identity-document evidence on a private asset", () => {
    const flags = evaluateRiskRules(
      baseInput({
        assets: [asset({ id: "asset-1", is_public: false })],
        evidence: [
          {
            id: "e1",
            asset_id: "asset-1",
            evidence_type: "IDENTITY_DOCUMENT",
            status: "SELF_DECLARED",
          },
        ],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "EVIDENCE_IDENTITY_DOCUMENT_ON_PUBLIC_ASSET")).toBe(
      false,
    );
  });

  it("never claims evidence establishes ownership", () => {
    const flags = evaluateRiskRules(
      baseInput({
        evidence: [{ id: "e1", asset_id: "a1", evidence_type: "CONTRACT", status: "VERIFIED" }],
      }),
    );
    const serialized = JSON.stringify(flags);
    expect(serialized).not.toMatch(/establishes? ownership|proves? ownership/i);
  });
});

describe("evaluateRiskRules — version/governance and legacy", () => {
  it("flags a missing effective date", () => {
    const flags = evaluateRiskRules(baseInput());
    expect(flags.some((f) => f.ruleCode === "VERSION_MISSING_EFFECTIVE_DATE")).toBe(true);
  });

  it("flags an ACTIVE passport missing core identity fields", () => {
    const flags = evaluateRiskRules(
      baseInput({ passport: { ...emptyPassport, status: "ACTIVE" } }),
    );
    expect(flags.some((f) => f.ruleCode === "VERSION_ACTIVE_BUT_INCOMPLETE")).toBe(true);
  });

  it("does not flag an ACTIVE passport with complete identity fields", () => {
    const flags = evaluateRiskRules(baseInput({ passport: fullPassport, assets: [asset()] }));
    expect(flags.some((f) => f.ruleCode === "VERSION_ACTIVE_BUT_INCOMPLETE")).toBe(false);
  });

  it("flags missing successor contact and missing posthumous declaration and missing review frequency", () => {
    const flags = evaluateRiskRules(baseInput());
    expect(flags.some((f) => f.ruleCode === "LEGACY_NO_SUCCESSOR_CONTACT")).toBe(true);
    expect(flags.some((f) => f.ruleCode === "LEGACY_NO_POSTHUMOUS_AI_DECLARATION")).toBe(true);
    expect(flags.some((f) => f.ruleCode === "LEGACY_NO_REVIEW_FREQUENCY")).toBe(true);
  });

  it("does not flag legacy gaps once declared", () => {
    const flags = evaluateRiskRules(
      baseInput({
        passport: fullPassport,
        assets: [asset()],
        aiConsents: [
          {
            id: "c1",
            asset_id: null,
            use_case: "POSTHUMOUS_ESTATE_USE",
            permission: "PROHIBIT",
            term: null,
            revocation_rule: null,
          },
        ],
      }),
    );
    expect(flags.some((f) => f.ruleCode === "LEGACY_NO_SUCCESSOR_CONTACT")).toBe(false);
    expect(flags.some((f) => f.ruleCode === "LEGACY_NO_POSTHUMOUS_AI_DECLARATION")).toBe(false);
    expect(flags.some((f) => f.ruleCode === "LEGACY_NO_REVIEW_FREQUENCY")).toBe(false);
  });
});

describe("evaluateRiskRules — determinism and stability", () => {
  it("produces the exact same flags for the same input, called twice", () => {
    const input = baseInput({ assets: [asset({ status: "DISPUTED" })] });
    const a = evaluateRiskRules(input);
    const b = evaluateRiskRules(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("every flag has a non-empty stable rule code and a valid severity", () => {
    const flags = evaluateRiskRules(baseInput({ assets: [asset({ status: "DISPUTED" })] }));
    for (const f of flags) {
      expect(f.ruleCode.length).toBeGreaterThan(0);
      expect(["CRITICAL", "HIGH", "MODERATE", "LOW"]).toContain(f.severity);
    }
  });
});
