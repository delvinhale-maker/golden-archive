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

export function authorityApiErrorResponse(error: unknown, fallbackMessage: string): Response {
  if (error instanceof AuthorityApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details ?? undefined } },
      { status: error.status },
    );
  }
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: fallbackMessage } },
    { status: 500 },
  );
}
