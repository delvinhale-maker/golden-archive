import { describe, expect, it } from "vitest";
import { actionGateApiSchema, evidenceApiSchema, parseJsonWithSchema } from "./api-validation";

const validAction = {
  passportId: "11111111-1111-4111-8111-111111111111",
  actionKey: "crm.proposal.send",
  amount: 100,
  amountKind: "PURCHASE" as const,
  currency: "usd",
  externalCommunication: true,
  idempotencyKey: "proposal-2026-09-09-0001",
};

describe("Agent Authority public API validation", () => {
  it("normalizes a valid action request", () => {
    const parsed = parseJsonWithSchema(actionGateApiSchema, validAction);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.currency).toBe("USD");
  });

  it.each([
    [{ ...validAction, passportId: "not-a-uuid" }],
    [{ ...validAction, amount: Number.NaN }],
    [{ ...validAction, amount: -1 }],
    [{ ...validAction, amount: 10, amountKind: undefined }],
    [{ ...validAction, amount: undefined, amountKind: "PURCHASE" }],
    [{ ...validAction, externalCommunication: "true" }],
    [{ ...validAction, dataClassification: "SECRET" }],
    [{ ...validAction, requestedAt: new Date().toISOString() }],
    [{ ...validAction, dailySpendToDate: 0 }],
    [{ ...validAction, extraAuthorityOverride: "ALLOW" }],
  ])("rejects malformed or caller-controlled fields %#", (payload) => {
    expect(parseJsonWithSchema(actionGateApiSchema, payload).success).toBe(false);
  });

  it("rejects signed evidence without confirmed execution", () => {
    const parsed = parseJsonWithSchema(evidenceApiSchema, {
      actionRequestId: "22222222-2222-4222-8222-222222222222",
      executionConfirmed: false,
      signedEvidencePresent: true,
      outcome: "SUCCEEDED",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown evidence payload fields", () => {
    const parsed = parseJsonWithSchema(evidenceApiSchema, {
      actionRequestId: "22222222-2222-4222-8222-222222222222",
      executionConfirmed: true,
      outcome: "SUCCEEDED",
      rawAccessToken: "must-not-enter-the-ledger",
    });
    expect(parsed.success).toBe(false);
  });
});
