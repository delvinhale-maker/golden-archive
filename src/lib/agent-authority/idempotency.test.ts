import { describe, expect, it, vi } from "vitest";
import { IdempotentDecisionPendingError, waitForIdempotentDecision } from "./idempotency";

describe("Agent Authority idempotency", () => {
  it("returns the winning decision when it becomes visible during a concurrent retry", async () => {
    const load = vi
      .fn<() => Promise<{ id: string } | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "decision-1" });

    const result = await waitForIdempotentDecision(load, {
      delaysMs: [0, 0, 0],
      sleep: async () => undefined,
    });

    expect(result).toEqual({ id: "decision-1" });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("fails with an explicit retryable error instead of recursing indefinitely", async () => {
    const load = vi.fn<() => Promise<null>>().mockResolvedValue(null);

    await expect(
      waitForIdempotentDecision(load, {
        delaysMs: [0, 0, 0],
        sleep: async () => undefined,
      }),
    ).rejects.toMatchObject({
      name: "IdempotentDecisionPendingError",
      code: "IDEMPOTENT_DECISION_PENDING",
      retryable: true,
    } satisfies Partial<IdempotentDecisionPendingError>);

    expect(load).toHaveBeenCalledTimes(3);
  });
});
