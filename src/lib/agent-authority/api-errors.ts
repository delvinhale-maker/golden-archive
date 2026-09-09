export type AuthorityApiErrorCode =
  | "AUTH_MISSING"
  | "AUTH_INVALID"
  | "KEY_EXPIRED"
  | "KEY_REVOKED"
  | "INSUFFICIENT_SCOPE"
  | "RATE_LIMITED"
  | "INVALID_INPUT"
  | "IDEMPOTENCY_CONFLICT"
  | "RESOURCE_NOT_FOUND"
  | "POLICY_BLOCKED"
  | "APPROVAL_REQUIRED"
  | "INTERNAL_ERROR";

export class AuthorityApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: AuthorityApiErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AuthorityApiError";
  }
}

function isRetryableIdempotencyPending(error: unknown): error is Error & { code: string; retryable: true } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "IDEMPOTENT_DECISION_PENDING" &&
      "retryable" in error &&
      (error as { retryable?: unknown }).retryable === true,
  );
}

function baseHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

export function authorityApiErrorResponse(error: unknown, fallbackMessage: string): Response {
  if (error instanceof AuthorityApiError) {
    const headers = baseHeaders();
    if (error.code === "RATE_LIMITED") {
      const resetAt = typeof error.details?.resetAt === "string" ? Date.parse(error.details.resetAt) : Number.NaN;
      const retrySeconds = Number.isFinite(resetAt) ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) : 60;
      headers.set("retry-after", String(retrySeconds));
      if (error.details?.limit != null) headers.set("x-ratelimit-limit", String(error.details.limit));
      headers.set("x-ratelimit-remaining", "0");
      if (error.details?.resetAt) headers.set("x-ratelimit-reset", String(error.details.resetAt));
    }
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details ?? undefined } },
      { status: error.status, headers },
    );
  }
  if (isRetryableIdempotencyPending(error)) {
    return Response.json(
      {
        error: {
          code: "IDEMPOTENCY_CONFLICT",
          message: error.message,
          details: { retryable: true, retryAfterSeconds: 1 },
        },
      },
      { status: 409, headers: baseHeaders({ "Retry-After": "1" }) },
    );
  }
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: fallbackMessage } },
    { status: 500, headers: baseHeaders() },
  );
}
