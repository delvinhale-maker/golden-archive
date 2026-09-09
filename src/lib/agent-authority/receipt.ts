import type { AuthorizationReceiptInput, EvidenceLevel } from "./types";

export function validateEvidenceLevel(input: AuthorizationReceiptInput): void {
  if (input.evidenceLevel === "EXECUTION_VERIFIED" && !input.executionConfirmed) {
    throw new Error("EXECUTION_VERIFIED requires confirmed execution evidence");
  }
  if (input.evidenceLevel === "SIGNED_EVIDENCE" && (!input.executionConfirmed || !input.signedEvidencePresent)) {
    throw new Error("SIGNED_EVIDENCE requires confirmed execution and signed evidence");
  }
  if (input.evidenceLevel === "APPROVAL_VERIFIED" && (!input.approvedBy || !input.approvedAt)) {
    throw new Error("APPROVAL_VERIFIED requires attributable human approval");
  }
}

export function highestPermittedEvidenceLevel(input: {
  approved: boolean;
  executionConfirmed: boolean;
  signedEvidencePresent: boolean;
}): EvidenceLevel {
  if (input.executionConfirmed && input.signedEvidencePresent) return "SIGNED_EVIDENCE";
  if (input.executionConfirmed) return "EXECUTION_VERIFIED";
  if (input.approved) return "APPROVAL_VERIFIED";
  return "DECLARED";
}
