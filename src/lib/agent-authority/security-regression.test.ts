import { describe, expect, it } from "vitest";
import { evaluateActionGate } from "./decision-engine";
import { diffPolicyVersions } from "./policy-diff";
import { verifyWebhookSignature, webhookSignatureHeaders } from "./webhooks.server";
import type { PassportPolicySnapshot } from "./types";

const policy = (overrides: Partial<PassportPolicySnapshot> = {}): PassportPolicySnapshot => ({
  passportId: "11111111-1111-4111-8111-111111111111",
  passportCode: "AV-AGT-00001",
  organizationId: "22222222-2222-4222-8222-222222222222",
  version: 7,
  status: "AUTHORIZED",
  authorizedAt: "2026-09-09T12:00:00.000Z",
  permissions: [{ actionKey: "crm.read", label: "Read CRM", decision: "ALLOW" }],
  limits: {
    currency: "USD",
    externalCommunicationPolicy: "APPROVAL_REQUIRED",
    financialActionsPolicy: "APPROVAL_REQUIRED",
    sensitiveDataPolicy: "APPROVAL_REQUIRED",
    highRiskRequiresApproval: true,
    allowedSystems: [],
    blockedSystems: [],
  },
  ...overrides,
});

describe("security release invariants", () => {
  it.each(["SUSPENDED", "REVOKED", "EXPIRED"] as const)("%s Passport fails closed", (status) => {
    const result = evaluateActionGate(policy({ status }), { actionKey: "crm.read", idempotencyKey: `status-${status}` });
    expect(result.decision).toBe("BLOCK");
  });

  it("decision is bound to the evaluated Passport policy version", () => {
    const result = evaluateActionGate(policy({ version: 19 }), { actionKey: "crm.read", idempotencyKey: "version-integrity" });
    expect(result.policyVersion).toBe(19);
    expect(result.passportCode).toBe("AV-AGT-00001");
  });

  it("an authority increase remains material and requires reauthorization", () => {
    const before = {
      identity: { agentName: "Agent", humanSponsor: "Owner", businessPurpose: "CRM research" },
      permissions: [{ actionKey: "crm.read", label: "Read CRM", decision: "APPROVAL_REQUIRED" as const }],
      limits: policy().limits,
    };
    const after = {
      ...before,
      permissions: [{ actionKey: "crm.read", label: "Read CRM", decision: "ALLOW" as const }],
    };
    const diff = diffPolicyVersions(before, after);
    expect(diff.hasMaterialIncrease).toBe(true);
    expect(diff.requiresPolicyChangeApproval).toBe(true);
    expect(diff.requiresReauthorization).toBe(true);
  });

  it("rejects stale webhook replay even when the HMAC itself is correct", () => {
    const body = JSON.stringify({ id: "evt_1" });
    const secret = "test-webhook-secret-should-be-server-side";
    const timestamp = "1700000000";
    const headers = webhookSignatureHeaders(body, secret, timestamp);
    const result = verifyWebhookSignature({
      body,
      secret,
      timestamp,
      signatureHeader: headers["x-aurumvault-signature"],
      nowSeconds: 1700001000,
      toleranceSeconds: 300,
    });
    expect(result).toEqual({ valid: false, reason: "STALE" });
  });

  it("rejects a signature copied to a different body", () => {
    const secret = "test-webhook-secret-should-be-server-side";
    const timestamp = "1800000000";
    const headers = webhookSignatureHeaders("original", secret, timestamp);
    const result = verifyWebhookSignature({
      body: "modified",
      secret,
      timestamp,
      signatureHeader: headers["x-aurumvault-signature"],
      nowSeconds: 1800000000,
    });
    expect(result).toEqual({ valid: false, reason: "MISMATCH" });
  });
});
