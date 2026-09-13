import { describe, expect, it } from "vitest";
import {
  applyDailySpendReservation,
  approvalExpiryForReservation,
  reserveDailyPurchaseSpend,
} from "./daily-spend-reservation.server";
import type { ActionGateResult } from "./types";

const baseResult: ActionGateResult = {
  decision: "ALLOW",
  reasonCodes: ["BASE_ALLOW"],
  primaryReason: "BASE_ALLOW",
  matchedActionKey: "purchase.create",
  policyVersion: 3,
  passportCode: "AVP-TEST",
  approvalRole: null,
};

describe("daily spend reservation", () => {
  it("preserves the evaluated decision when the atomic reservation is accepted", () => {
    const result = applyDailySpendReservation(baseResult, {
      accepted: true,
      reservationId: "reservation-1",
      committedAmount: 20,
      reservedAmount: 10,
      projectedAmount: 60,
      reservationExpiresAt: "2026-09-14T00:00:00.000Z",
    });
    expect(result).toEqual(baseResult);
  });

  it("fails closed with MAX_DAILY_SPEND_EXCEEDED when the reservation is rejected", () => {
    const result = applyDailySpendReservation(baseResult, {
      accepted: false,
      reservationId: null,
      committedAmount: 60,
      reservedAmount: 20,
      projectedAmount: 120,
      reservationExpiresAt: "2026-09-14T00:00:00.000Z",
    });
    expect(result.decision).toBe("BLOCK");
    expect(result.reasonCodes).toEqual(["MAX_DAILY_SPEND_EXCEEDED"]);
    expect(result.primaryReason).toBe("MAX_DAILY_SPEND_EXCEEDED");
    expect(result.approvalRole).toBeNull();
  });

  it("uses the earlier reservation boundary for approval expiry", () => {
    expect(
      approvalExpiryForReservation("2026-09-13T23:30:00.000Z", "2026-09-14T00:00:00.000Z"),
    ).toBe("2026-09-14T00:00:00.000Z");
  });

  it("defaults approval expiry to 24 hours when no spend reservation exists", () => {
    expect(approvalExpiryForReservation("2026-09-13T12:00:00.000Z", null)).toBe(
      "2026-09-14T12:00:00.000Z",
    );
  });

  it("normalizes the database RPC response", async () => {
    const client = {
      rpc: async (name: string, payload: unknown) => {
        expect(name).toBe("reserve_agent_daily_spend");
        expect(payload).toEqual({ p_workspace_id: "workspace-1", p_action_request_id: "request-1" });
        return {
          data: [{
            accepted: true,
            reservation_id: "reservation-1",
            committed_amount: "25.50",
            reserved_amount: "10.00",
            projected_amount: "75.50",
            reservation_expires_at: "2026-09-14T00:00:00.000Z",
          }],
          error: null,
        };
      },
    };
    await expect(
      reserveDailyPurchaseSpend({ client, workspaceId: "workspace-1", actionRequestId: "request-1" }),
    ).resolves.toEqual({
      accepted: true,
      reservationId: "reservation-1",
      committedAmount: 25.5,
      reservedAmount: 10,
      projectedAmount: 75.5,
      reservationExpiresAt: "2026-09-14T00:00:00.000Z",
    });
  });
});
