import { describe, expect, it } from "vitest";
import { authorityApiErrorResponse, AuthorityApiError } from "./api-errors";
import { IdempotentDecisionPendingError } from "./idempotency";

describe("Agent Authority API errors", () => {
  it("maps a pending idempotent decision to a retryable 409", async () => {
    const response = authorityApiErrorResponse(new IdempotentDecisionPendingError(), "fallback");
    expect(response.status).toBe(409);
    expect(response.headers.get("Retry-After")).toBe("1");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "IDEMPOTENCY_CONFLICT",
        message: "Idempotent action request is still being finalized; retry the same idempotencyKey",
        details: { retryable: true },
      },
    });
  });

  it("preserves structured AuthorityApiError responses", async () => {
    const response = authorityApiErrorResponse(new AuthorityApiError(400, "INVALID_INPUT", "bad request"), "fallback");
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: "INVALID_INPUT", message: "bad request" } });
  });
});
