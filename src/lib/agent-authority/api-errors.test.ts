import { describe, expect, it } from "vitest";
import { authorityApiErrorResponse, AuthorityApiError } from "./api-errors";
import { IdempotentDecisionPendingError } from "./idempotency";

describe("Agent Authority API errors", () => {
  it("maps a pending idempotent decision to a retryable 409", async () => {
    const response = authorityApiErrorResponse(new IdempotentDecisionPendingError(), "fallback");
    expect(response.status).toBe(409);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "IDEMPOTENCY_CONFLICT",
        message: "Idempotent action request is still being finalized; retry the same idempotencyKey",
        details: { retryable: true, retryAfterSeconds: 1 },
      },
    });
  });

  it("emits rate-limit retry metadata without caching the error", async () => {
    const resetAt = new Date(Date.now() + 30_000).toISOString();
    const response = authorityApiErrorResponse(
      new AuthorityApiError(429, "RATE_LIMITED", "API rate limit exceeded", { limit: 60, remaining: 0, resetAt }),
      "fallback",
    );
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(response.headers.get("x-ratelimit-limit")).toBe("60");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(response.headers.get("x-ratelimit-reset")).toBe(resetAt);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("preserves structured AuthorityApiError responses", async () => {
    const response = authorityApiErrorResponse(new AuthorityApiError(400, "INVALID_INPUT", "bad request"), "fallback");
    expect(response.status).toBe(400);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual({ error: { code: "INVALID_INPUT", message: "bad request" } });
  });
});
