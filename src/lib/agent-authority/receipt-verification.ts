import { hashReceipt } from "./integrity.server";
import type {
  AuthorizationReceiptInput,
  AuthorityDecision,
  EvidenceLevel,
  ReceiptVerificationResult,
} from "./types";

export interface ReceiptRecordForVerification {
  receiptCode?: string | null;
  passportCode?: string | null;
  agentName?: string | null;
  actionKey?: string | null;
  target?: string | null;
  authorityResult?: AuthorityDecision | null;
  policyCode?: string | null;
  policyVersion?: number | null;
  requestedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  executedAt?: string | null;
  evidenceLevel?: EvidenceLevel | null;
  outcome?: string | null;
  evidenceReferences?: string[] | null;
  integrityHash?: string | null;
}

export function verifyAuthorizationReceipt(
  record: ReceiptRecordForVerification,
  now = new Date(),
): ReceiptVerificationResult {
  const required: Array<keyof ReceiptRecordForVerification> = [
    "receiptCode",
    "passportCode",
    "agentName",
    "actionKey",
    "authorityResult",
    "policyCode",
    "policyVersion",
    "requestedAt",
    "evidenceLevel",
    "outcome",
    "integrityHash",
  ];
  const missingFields = required.filter((field) => record[field] == null || record[field] === "").map(String);
  if (record.evidenceLevel === "APPROVAL_VERIFIED" && (!record.approvedBy || !record.approvedAt)) {
    missingFields.push("approvedBy", "approvedAt");
  }
  if ((record.evidenceLevel === "EXECUTION_VERIFIED" || record.evidenceLevel === "SIGNED_EVIDENCE") && !record.executedAt) {
    missingFields.push("executedAt");
  }
  if (missingFields.length > 0) {
    return {
      status: "INCOMPLETE",
      storedHash: record.integrityHash ?? null,
      recomputedHash: null,
      missingFields: [...new Set(missingFields)],
      verifiedAt: now.toISOString(),
    };
  }

  const input: AuthorizationReceiptInput = {
    receiptCode: record.receiptCode!,
    passportCode: record.passportCode!,
    agentName: record.agentName!,
    actionKey: record.actionKey!,
    target: record.target ?? null,
    authorityResult: record.authorityResult!,
    policyCode: record.policyCode!,
    policyVersion: Number(record.policyVersion),
    requestedAt: record.requestedAt!,
    approvedBy: record.approvedBy ?? null,
    approvedAt: record.approvedAt ?? null,
    ...(record.executedAt ? { executedAt: record.executedAt } : {}),
    executionConfirmed: record.evidenceLevel === "EXECUTION_VERIFIED" || record.evidenceLevel === "SIGNED_EVIDENCE",
    signedEvidencePresent: record.evidenceLevel === "SIGNED_EVIDENCE",
    evidenceLevel: record.evidenceLevel!,
    outcome: record.outcome!,
    evidenceReferences: record.evidenceReferences ?? [],
  };
  const recomputedHash = hashReceipt(input);
  return {
    status: recomputedHash === record.integrityHash ? "VALID" : "TAMPERED",
    storedHash: record.integrityHash,
    recomputedHash,
    missingFields: [],
    verifiedAt: now.toISOString(),
  };
}
