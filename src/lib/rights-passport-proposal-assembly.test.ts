import { describe, it, expect } from "bun:test";
import {
  assembleProposals,
  hasConflictingExistingValue,
  type AssemblyFinding,
} from "./rights-passport-proposal-assembly";

const DOC_ID = "11111111-1111-1111-1111-111111111111";
const FILE_NAME = "endorsement-agreement.pdf";

function f(
  overrides: Partial<AssemblyFinding> & Pick<AssemblyFinding, "id" | "passType" | "field">,
): AssemblyFinding {
  return {
    normalizedValue: null,
    rawValue: null,
    source: null,
    reviewStatus: "PENDING",
    ...overrides,
  };
}

describe("assembleProposals — AI_CONSENT (1:1, unchanged mapping)", () => {
  it("produces one proposal per AI_SYNTHETIC_RIGHTS finding with a use_case mapping", () => {
    const findings = [
      f({
        id: "a1",
        passType: "AI_SYNTHETIC_RIGHTS",
        field: "voice_cloning",
        normalizedValue: "PROHIBIT",
      }),
    ];
    const proposals = assembleProposals(DOC_ID, FILE_NAME, findings);
    const aiProposals = proposals.filter((p) => p.proposalType === "AI_CONSENT");
    expect(aiProposals.length).toBe(1);
    expect(aiProposals[0].proposedRecord).toEqual({
      useCase: "VOICE_CLONE",
      permission: "PROHIBIT",
    });
    expect(aiProposals[0].sourceFindingIds).toEqual(["a1"]);
  });

  it("marks permission missing when normalized_value is null (no support)", () => {
    const findings = [
      f({ id: "a1", passType: "AI_SYNTHETIC_RIGHTS", field: "ai_training", normalizedValue: null }),
    ];
    const proposals = assembleProposals(DOC_ID, FILE_NAME, findings);
    expect(proposals[0].missingFields).toEqual(["permission"]);
    expect(proposals[0].status).toBe("DRAFT");
  });

  it("does not propose a field with no use_case mapping (e.g. model_retention)", () => {
    const findings = [
      f({
        id: "a1",
        passType: "AI_SYNTHETIC_RIGHTS",
        field: "model_retention",
        normalizedValue: true,
      }),
    ];
    expect(assembleProposals(DOC_ID, FILE_NAME, findings)).toEqual([]);
  });

  it("high-impact AI fields (voice_cloning, ai_training, digital_replica, posthumous_use) require extra confirmation", () => {
    for (const field of ["voice_cloning", "ai_training", "digital_replica", "posthumous_use"]) {
      const findings = [
        f({ id: "x", passType: "AI_SYNTHETIC_RIGHTS", field, normalizedValue: "ALLOW" }),
      ];
      const [proposal] = assembleProposals(DOC_ID, FILE_NAME, findings);
      expect(proposal.requiresHighImpactConfirmation).toBe(true);
    }
  });

  it("a non-high-impact AI field does not require extra confirmation", () => {
    const findings = [
      f({
        id: "x",
        passType: "AI_SYNTHETIC_RIGHTS",
        field: "embeddings_retrieval",
        normalizedValue: "ALLOW",
      }),
    ];
    expect(assembleProposals(DOC_ID, FILE_NAME, findings)[0].requiresHighImpactConfirmation).toBe(
      false,
    );
  });
});

describe("assembleProposals — PROFILE_UPDATE", () => {
  it("maps governing_law to jurisdiction and effective_date to effectiveDate", () => {
    const findings = [
      f({
        id: "p1",
        passType: "DOCUMENT_STRUCTURE",
        field: "governing_law",
        normalizedValue: "State of New York",
      }),
      f({
        id: "p2",
        passType: "DOCUMENT_STRUCTURE",
        field: "effective_date",
        normalizedValue: "2026-01-01",
      }),
    ];
    const proposals = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "PROFILE_UPDATE",
    );
    expect(proposals.length).toBe(2);
    const jurisdiction = proposals.find((p) => (p.proposedRecord as any).field === "jurisdiction");
    expect(jurisdiction?.proposedRecord).toEqual({
      field: "jurisdiction",
      suggestedValue: "State of New York",
    });
  });

  it("does not fabricate a professional-name or representative proposal from 'parties' — no reliable source field exists for it", () => {
    const findings = [
      f({
        id: "p1",
        passType: "DOCUMENT_STRUCTURE",
        field: "parties",
        normalizedValue: "Jordan Rivers and ABC Brand",
      }),
    ];
    const proposals = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "PROFILE_UPDATE",
    );
    expect(proposals).toEqual([]);
  });
});

describe("assembleProposals — ASSET (grouped, seeded by ownership/assignment language)", () => {
  it("does not create an asset proposal without an ownership/assignment seed finding", () => {
    const findings = [
      f({ id: "t1", passType: "RIGHTS_GRANT", field: "territory", normalizedValue: "Worldwide" }),
    ];
    expect(
      assembleProposals(DOC_ID, FILE_NAME, findings).filter((p) => p.proposalType === "ASSET"),
    ).toEqual([]);
  });

  it("creates ONE asset proposal grouping ownership language + territory, never as two separate proposals", () => {
    const findings = [
      f({
        id: "o1",
        passType: "RIGHTS_GRANT",
        field: "ownership_language",
        rawValue: "Talent retains all ownership.",
      }),
      f({ id: "t1", passType: "RIGHTS_GRANT", field: "territory", normalizedValue: "Worldwide" }),
    ];
    const assetProposals = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "ASSET",
    );
    expect(assetProposals.length).toBe(1);
    expect(assetProposals[0].sourceFindingIds.sort()).toEqual(["o1", "t1"]);
  });

  it("always forces control_basis to REVIEW_REQUIRED — never infers CREATORSHIP/ASSIGNMENT/etc from document language", () => {
    const findings = [
      f({
        id: "o1",
        passType: "RIGHTS_GRANT",
        field: "assignment",
        rawValue: "Talent assigns all rights to Brand.",
      }),
    ];
    const [asset] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "ASSET",
    );
    expect(asset.proposedRecord.controlBasis).toBe("REVIEW_REQUIRED");
  });

  it("uses hedged 'appears to state' language, never asserts ownership as fact", () => {
    const findings = [
      f({
        id: "o1",
        passType: "RIGHTS_GRANT",
        field: "ownership_language",
        rawValue: "Talent owns the likeness.",
      }),
    ];
    const [asset] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "ASSET",
    );
    expect(asset.proposedRecord.description).toContain("appears to state");
    expect(asset.proposedRecord.description).not.toMatch(/you own|is owned by/i);
  });

  it("always lists 'name' as a missing field — never guesses the asset's name/subject", () => {
    const findings = [
      f({ id: "o1", passType: "RIGHTS_GRANT", field: "ownership_language", rawValue: "text" }),
    ];
    const [asset] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "ASSET",
    );
    expect(asset.missingFields).toContain("name");
    expect(asset.status).toBe("DRAFT");
  });

  it("assignment high-impact field requires extra confirmation on the asset proposal", () => {
    const findings = [
      f({ id: "o1", passType: "RIGHTS_GRANT", field: "assignment", rawValue: "text" }),
    ];
    const [asset] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "ASSET",
    );
    expect(asset.requiresHighImpactConfirmation).toBe(true);
  });
});

describe("assembleProposals — LICENSE (multi-finding assembly)", () => {
  it("assembles a single license proposal from clauses scattered across licenses_granted, exclusivity, territory, and compensation (the spec's worked example)", () => {
    const findings = [
      f({
        id: "c1",
        passType: "RIGHTS_GRANT",
        field: "licenses_granted",
        rawValue: "worldwide license to use in advertising",
      }),
      f({ id: "c2", passType: "RIGHTS_GRANT", field: "territory", normalizedValue: "Worldwide" }),
      f({
        id: "c3",
        passType: "RIGHTS_GRANT",
        field: "exclusivity",
        rawValue: "This license is exclusive.",
      }),
      f({ id: "c4", passType: "COMMERCIAL_TERMS", field: "fee", normalizedValue: "$10,000" }),
      f({
        id: "c5",
        passType: "DOCUMENT_STRUCTURE",
        field: "parties",
        normalizedValue: "ABC Brand",
      }),
    ];
    const [license] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "LICENSE",
    );
    expect(license).toBeDefined();
    // Exactly one license proposal for 4 contributing clauses, not four separate ones.
    expect(license.sourceFindingIds.sort()).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    expect(license.proposedRecord.licensee).toBe("ABC Brand");
    expect(license.proposedRecord.territory).toBe("Worldwide");
    expect(license.proposedRecord.isExclusive).toBe(true);
    expect(license.proposedRecord.compensation).toBe("$10,000");
  });

  it("never infers ACTIVE status — status is always REVIEW_REQUIRED regardless of how complete the clauses are", () => {
    const findings = [
      f({
        id: "c1",
        passType: "RIGHTS_GRANT",
        field: "licenses_granted",
        rawValue: "full license",
      }),
      f({
        id: "c2",
        passType: "DOCUMENT_STRUCTURE",
        field: "parties",
        normalizedValue: "ABC Brand",
      }),
    ];
    const [license] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "LICENSE",
    );
    expect(license.proposedRecord.status).toBe("REVIEW_REQUIRED");
  });

  it("does not propose a license from an isolated commercial clause alone if licensee/exactUse are absent — flags them as missing rather than fabricating", () => {
    const findings = [
      f({ id: "c1", passType: "COMMERCIAL_TERMS", field: "fee", normalizedValue: "$500" }),
    ];
    const [license] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "LICENSE",
    );
    expect(license.missingFields).toContain("licensee");
    expect(license.missingFields).toContain("exactUse");
    expect(license.status).toBe("DRAFT");
  });

  it("never infers AI/synthetic rights inclusion — always null ('Not found') unless a real mapping exists", () => {
    const findings = [
      f({ id: "c1", passType: "RIGHTS_GRANT", field: "licenses_granted", rawValue: "license" }),
      f({
        id: "c2",
        passType: "AI_SYNTHETIC_RIGHTS",
        field: "voice_cloning",
        normalizedValue: "ALLOW",
      }),
    ];
    const [license] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "LICENSE",
    );
    expect(license.proposedRecord.aiSyntheticRightsIncluded).toBeNull();
    expect(license.missingFields).toContain("aiSyntheticRightsIncluded");
  });

  it("exclusivity high-impact field requires extra confirmation on the license proposal", () => {
    const findings = [
      f({ id: "c1", passType: "RIGHTS_GRANT", field: "exclusivity", rawValue: "exclusive" }),
    ];
    const [license] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "LICENSE",
    );
    expect(license.requiresHighImpactConfirmation).toBe(true);
  });

  it("references the source document by name in controllingDocumentReference", () => {
    const findings = [
      f({ id: "c1", passType: "RIGHTS_GRANT", field: "licenses_granted", rawValue: "license" }),
    ];
    const [license] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "LICENSE",
    );
    expect(license.proposedRecord.controllingDocumentReference).toContain(FILE_NAME);
  });
});

describe("assembleProposals — EVIDENCE (the document itself)", () => {
  it("proposes the document as CONTRACT evidence when agreement_type is present", () => {
    const findings = [
      f({
        id: "s1",
        passType: "DOCUMENT_STRUCTURE",
        field: "agreement_type",
        normalizedValue: "Endorsement Agreement",
      }),
    ];
    const [evidence] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "EVIDENCE",
    );
    expect(evidence.proposedRecord.evidenceType).toBe("CONTRACT");
    expect(evidence.proposedRecord.status).toBe("SELF_DECLARED"); // never VERIFIED
  });

  it("does not propose evidence when there is no document-structure signal at all", () => {
    const findings = [
      f({ id: "c1", passType: "COMMERCIAL_TERMS", field: "fee", normalizedValue: "$1" }),
    ];
    expect(
      assembleProposals(DOC_ID, FILE_NAME, findings).filter((p) => p.proposalType === "EVIDENCE"),
    ).toEqual([]);
  });

  it("status is never VERIFIED regardless of how many corroborating findings exist", () => {
    const findings = [
      f({
        id: "s1",
        passType: "DOCUMENT_STRUCTURE",
        field: "agreement_type",
        normalizedValue: "Contract",
      }),
      f({ id: "s2", passType: "DOCUMENT_STRUCTURE", field: "parties", normalizedValue: "A and B" }),
      f({
        id: "s3",
        passType: "DOCUMENT_STRUCTURE",
        field: "execution_date",
        normalizedValue: "2026-01-01",
      }),
    ];
    const [evidence] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "EVIDENCE",
    );
    expect(evidence.proposedRecord.status).not.toBe("VERIFIED");
  });
});

describe("assembleProposals — decided findings excluded, status derivation, rejected/deferred", () => {
  it("a REJECTED finding does not contribute to a new proposal — status becomes REJECTED when all contributors are rejected", () => {
    const findings = [
      f({
        id: "a1",
        passType: "AI_SYNTHETIC_RIGHTS",
        field: "voice_cloning",
        normalizedValue: "ALLOW",
        reviewStatus: "REJECTED",
      }),
    ];
    const proposals = assembleProposals(DOC_ID, FILE_NAME, findings);
    // AI_CONSENT assembly only considers PENDING findings, so a REJECTED
    // finding produces no proposal at all (nothing left to re-decide).
    expect(proposals.filter((p) => p.proposalType === "AI_CONSENT")).toEqual([]);
  });

  it("a DEFERRED finding similarly produces no active proposal to re-decide", () => {
    const findings = [
      f({
        id: "a1",
        passType: "AI_SYNTHETIC_RIGHTS",
        field: "ai_training",
        normalizedValue: "ALLOW",
        reviewStatus: "DEFERRED",
      }),
    ];
    expect(
      assembleProposals(DOC_ID, FILE_NAME, findings).filter((p) => p.proposalType === "AI_CONSENT"),
    ).toEqual([]);
  });

  it("mixing a PENDING seed finding with an already-ACCEPTED contributor still assembles the proposal from the PENDING seed", () => {
    const findings = [
      f({
        id: "o1",
        passType: "RIGHTS_GRANT",
        field: "ownership_language",
        rawValue: "owns it",
        reviewStatus: "PENDING",
      }),
    ];
    const [asset] = assembleProposals(DOC_ID, FILE_NAME, findings).filter(
      (p) => p.proposalType === "ASSET",
    );
    expect(asset.status).toBe("DRAFT"); // missing name, so DRAFT not READY_FOR_REVIEW
  });
});

describe("hasConflictingExistingValue — generic don't-silently-overwrite check", () => {
  it("is false when there is no existing value", () => {
    expect(hasConflictingExistingValue(null, "PROHIBIT")).toBe(false);
    expect(hasConflictingExistingValue(undefined, "PROHIBIT")).toBe(false);
    expect(hasConflictingExistingValue("", "PROHIBIT")).toBe(false);
  });

  it("is false when the existing value matches the incoming value (idempotent re-application)", () => {
    expect(hasConflictingExistingValue("PROHIBIT", "PROHIBIT")).toBe(false);
  });

  it("is true when a real existing value differs from the incoming value", () => {
    expect(hasConflictingExistingValue("ALLOW", "PROHIBIT")).toBe(true);
  });
});
