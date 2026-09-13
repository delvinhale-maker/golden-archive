import { evaluateActionGate } from "./decision-engine";
import type { ActionGateRequest, PassportPolicySnapshot, ShadowSimulationResult } from "./types";

/**
 * Shadow Mode intentionally reuses the production decision engine but marks the
 * result non-executable. Callers must never create approvals, receipts, execution
 * instructions, or external side effects from this result.
 */
export function simulateActionGate(
  passport: PassportPolicySnapshot,
  request: ActionGateRequest,
  now = new Date(request.requestedAt ?? Date.now()),
): ShadowSimulationResult {
  return {
    mode: "SHADOW",
    executable: false,
    simulatedAt: now.toISOString(),
    request: { ...request, requestedAt: request.requestedAt ?? now.toISOString() },
    result: evaluateActionGate(passport, request, now),
  };
}
