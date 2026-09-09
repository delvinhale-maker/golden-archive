import { describe, expect, it } from "vitest";
import { validateEvidenceLevel } from "./receipt";
import type { AuthorizationReceiptInput } from "./types";

const base: AuthorizationReceiptInput = {
  receiptCode: "AV-000001",
  passportCode: "AV-AGT-00001",
  agentName: "Sales Agent 03",
  actionKey: "proposal.send",
  authorityResult: "ALLOW",
  policyCode: "SALES-004",
  policyVersion: 1,
  requestedAt: "2026-09-09T12:00:00Z",
  executionConfirmed: false,
  signedEvidencePresent: false,
  evidenceLevel: "DECLARED",
  outcome: "recorded",
};

describe("receipt evidence integrity", () => {
  it("rejects EXECUTION_VERIFIED without execution evidence", () => {
    expect(() => validateEvidenceLevel({ ...base, evidenceLevel: "EXECUTION_VERIFIED" })).toThrow(/confirmed execution/i);
  });

  it("accepts EXECUTION_VERIFIED with execution evidence", () => {
    expect(() => validateEvidenceLevel({ ...base, evidenceLevel: "EXECUTION_VERIFIED", executionConfirmed: true })).not.toThrow();
  });

  it("rejects approval-verified without an attributable human", () => {
    expect(() => validateEvidenceLevel({ ...base, evidenceLevel: "APPROVAL_VERIFIED" })).toThrow(/human approval/i);
  });
});
