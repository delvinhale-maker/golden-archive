import { describe, expect, it } from "vitest";
import { evaluateActionGate } from "./decision-engine";
import type { PassportPolicySnapshot } from "./types";

const passport = (overrides: Partial<PassportPolicySnapshot> = {}): PassportPolicySnapshot => ({
  passportId: "passport-1",
  passportCode: "AV-AGT-00001",
  organizationId: "org-1",
  version: 1,
  status: "AUTHORIZED",
  authorizedAt: "2026-09-01T00:00:00Z",
  authorizationExpiresAt: "2027-09-01T00:00:00Z",
  permissions: [
    { actionKey: "email.read", label: "Read email", decision: "ALLOW", system: "Email" },
    { actionKey: "proposal.send", label: "Send proposal", decision: "ALLOW", system: "CRM", approvalRole: "APPROVER" },
    { actionKey: "refund.issue", label: "Issue refund", decision: "ALLOW", system: "Payments" },
    { actionKey: "invoice.send", label: "Send invoice", decision: "APPROVAL_REQUIRED", system: "Accounting" },
  ],
  limits: {
    currency: "USD",
    maxSinglePurchase: 100,
    maxDailySpend: 250,
    maxRefund: 0,
    maxInvoice: 2500,
    externalCommunicationPolicy: "APPROVAL_REQUIRED",
    financialActionsPolicy: "BLOCK",
    sensitiveDataPolicy: "BLOCK",
    highRiskRequiresApproval: true,
    allowedSystems: [],
    blockedSystems: [],
  },
  ...overrides,
});

const req = (actionKey: string, extra: Record<string, unknown> = {}) => ({
  actionKey,
  idempotencyKey: `idem-${actionKey}`,
  requestedAt: "2026-09-09T12:00:00Z",
  ...extra,
} as any);

describe("AI Agent Authority Passport Action Gate", () => {
  it("blocks unknown actions", () => {
    expect(evaluateActionGate(passport(), req("unknown.action")).decision).toBe("BLOCK");
  });

  it("blocks suspended passports", () => {
    expect(evaluateActionGate(passport({ status: "SUSPENDED" }), req("email.read")).primaryReason).toBe("PASSPORT_SUSPENDED");
  });

  it("blocks expired passports", () => {
    expect(evaluateActionGate(passport({ authorizationExpiresAt: "2026-09-08T00:00:00Z" }), req("email.read")).primaryReason).toBe("PASSPORT_EXPIRED");
  });

  it("lets a normal explicitly allowed action pass", () => {
    expect(evaluateActionGate(passport(), req("email.read")).decision).toBe("ALLOW");
  });

  it("financial prohibition overrides an ALLOW permission", () => {
    const output = evaluateActionGate(passport(), req("refund.issue", { financialAction: true, amount: 0, amountKind: "REFUND", currency: "USD" }));
    expect(output).toMatchObject({ decision: "BLOCK", primaryReason: "FINANCIAL_ACTION_PROHIBITED" });
  });

  it("sensitive-data prohibition overrides ALLOW", () => {
    const output = evaluateActionGate(passport(), req("email.read", { sensitiveData: true }));
    expect(output).toMatchObject({ decision: "BLOCK", primaryReason: "SENSITIVE_DATA_PROHIBITED" });
  });

  it("promotes external communication to approval required", () => {
    const output = evaluateActionGate(passport(), req("proposal.send", { externalCommunication: true }));
    expect(output.decision).toBe("APPROVAL_REQUIRED");
    expect(output.reasonCodes).toContain("EXTERNAL_COMMUNICATION_APPROVAL_REQUIRED");
  });

  it("blocks purchases over the hard cap", () => {
    const p = passport({
      limits: { ...passport().limits, financialActionsPolicy: "ALLOW" },
      permissions: [...passport().permissions, { actionKey: "purchase.initiate", label: "Purchase", decision: "ALLOW", system: "Payments" }],
    });
    const output = evaluateActionGate(p, req("purchase.initiate", { financialAction: true, amount: 101, amountKind: "PURCHASE", currency: "USD" }));
    expect(output).toMatchObject({ decision: "BLOCK", primaryReason: "MAX_PURCHASE_EXCEEDED" });
  });

  it("preserves base approval-required authority", () => {
    expect(evaluateActionGate(passport(), req("invoice.send")).decision).toBe("APPROVAL_REQUIRED");
  });
});
