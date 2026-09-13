export const IDEMPOTENCY_DECISION_RETRY_DELAYS_MS = [0, 25, 50, 100, 200, 400, 800] as const;

export class IdempotentDecisionPendingError extends Error {
  readonly code = "IDEMPOTENT_DECISION_PENDING";
  readonly retryable = true;

  constructor() {
    super("Idempotent action request is still being finalized; retry the same idempotencyKey");
    this.name = "IdempotentDecisionPendingError";
  }
}

export async function waitForIdempotentDecision<T>(
  loadDecision: () => Promise<T | null>,
  options: {
    delaysMs?: readonly number[];
    sleep?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<T> {
  const delaysMs = options.delaysMs ?? IDEMPOTENCY_DECISION_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  for (const delayMs of delaysMs) {
    if (delayMs > 0) await sleep(delayMs);
    const decision = await loadDecision();
    if (decision) return decision;
  }

  throw new IdempotentDecisionPendingError();
}
