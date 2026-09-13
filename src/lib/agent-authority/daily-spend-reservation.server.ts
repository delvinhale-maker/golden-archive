import type { ActionGateResult } from "./types";

export interface DailySpendReservationResult {
  accepted: boolean;
  reservationId: string | null;
  committedAmount: number;
  reservedAmount: number;
  projectedAmount: number;
  reservationExpiresAt: string | null;
}

export async function reserveDailyPurchaseSpend(input: {
  client: any;
  workspaceId: string;
  actionRequestId: string;
}): Promise<DailySpendReservationResult> {
  const { data, error } = await input.client.rpc("reserve_agent_daily_spend", {
    p_workspace_id: input.workspaceId,
    p_action_request_id: input.actionRequestId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Daily spend reservation RPC returned no result");
  return {
    accepted: Boolean(row.accepted),
    reservationId: row.reservation_id ?? null,
    committedAmount: Number(row.committed_amount ?? 0),
    reservedAmount: Number(row.reserved_amount ?? 0),
    projectedAmount: Number(row.projected_amount ?? 0),
    reservationExpiresAt: row.reservation_expires_at ?? null,
  };
}

export function applyDailySpendReservation(
  result: ActionGateResult,
  reservation: DailySpendReservationResult,
): ActionGateResult {
  if (reservation.accepted) return result;
  return {
    ...result,
    decision: "BLOCK",
    reasonCodes: ["MAX_DAILY_SPEND_EXCEEDED"],
    primaryReason: "MAX_DAILY_SPEND_EXCEEDED",
    approvalRole: null,
  };
}

export function approvalExpiryForReservation(
  requestedAt: string,
  reservationExpiresAt?: string | null,
): string {
  const requested = new Date(requestedAt).getTime();
  if (!Number.isFinite(requested)) throw new Error("Invalid server request timestamp");
  const defaultExpiry = requested + 24 * 60 * 60 * 1000;
  if (!reservationExpiresAt) return new Date(defaultExpiry).toISOString();
  const reservationExpiry = new Date(reservationExpiresAt).getTime();
  if (!Number.isFinite(reservationExpiry)) throw new Error("Invalid daily spend reservation expiry");
  return new Date(Math.min(defaultExpiry, reservationExpiry)).toISOString();
}
