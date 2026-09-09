import { createHmac, timingSafeEqual } from "node:crypto";

export type AuthorityWebhookEvent =
  | "decision.created"
  | "approval.requested"
  | "approval.decided"
  | "receipt.created"
  | "passport.suspended"
  | "passport.reinstated"
  | "passport.expired"
  | "review.due"
  | "policy.change_requested"
  | "policy.change_decided"
  | "incident.created"
  | "incident.contained"
  | "incident.closed"
  | "delegation.created"
  | "delegation.revoked";

export const WEBHOOK_MAX_ATTEMPTS = 6;
const BACKOFF_SECONDS = [0, 60, 5 * 60, 15 * 60, 60 * 60, 6 * 60 * 60];

export function signWebhookBody(body: string, secret: string, timestamp: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
}

export function webhookSignatureHeaders(body: string, secret: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  return {
    "x-aurumvault-timestamp": timestamp,
    "x-aurumvault-signature": `v1=${signWebhookBody(body, secret, timestamp)}`,
  };
}

export function verifyWebhookSignature(input: {
  body: string;
  secret: string;
  timestamp: string;
  signatureHeader: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): { valid: boolean; reason: "VALID" | "MALFORMED" | "STALE" | "MISMATCH" } {
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || !input.signatureHeader.startsWith("v1=")) {
    return { valid: false, reason: "MALFORMED" };
  }
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return { valid: false, reason: "STALE" };
  }
  const expected = Buffer.from(signWebhookBody(input.body, input.secret, input.timestamp), "hex");
  const presentedHex = input.signatureHeader.slice(3);
  if (!/^[a-f0-9]{64}$/i.test(presentedHex)) return { valid: false, reason: "MALFORMED" };
  const presented = Buffer.from(presentedHex, "hex");
  const valid = expected.length === presented.length && timingSafeEqual(expected, presented);
  return { valid, reason: valid ? "VALID" : "MISMATCH" };
}

export function webhookBackoffSeconds(attemptNumber: number): number {
  const index = Math.max(0, Math.min(BACKOFF_SECONDS.length - 1, Math.floor(attemptNumber) - 1));
  return BACKOFF_SECONDS[index];
}

export function nextWebhookAttemptAt(attemptNumber: number, now = new Date()): string | null {
  if (attemptNumber >= WEBHOOK_MAX_ATTEMPTS) return null;
  const seconds = webhookBackoffSeconds(attemptNumber + 1);
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

export function classifyWebhookDelivery(input: {
  attemptCount: number;
  responseStatus?: number | null;
  networkError?: boolean;
  now?: Date;
}): {
  state: "DELIVERED" | "RETRY_SCHEDULED" | "DEAD_LETTER";
  nextAttemptAt: string | null;
  errorCategory: string | null;
} {
  const responseStatus = input.responseStatus ?? null;
  if (!input.networkError && responseStatus != null && responseStatus >= 200 && responseStatus < 300) {
    return { state: "DELIVERED", nextAttemptAt: null, errorCategory: null };
  }
  const errorCategory = input.networkError
    ? "NETWORK_ERROR"
    : responseStatus === 408 || responseStatus === 429
      ? "RETRYABLE_HTTP"
      : responseStatus != null && responseStatus >= 500
        ? "UPSTREAM_5XX"
        : "NON_SUCCESS_HTTP";
  if (input.attemptCount >= WEBHOOK_MAX_ATTEMPTS) {
    return { state: "DEAD_LETTER", nextAttemptAt: null, errorCategory };
  }
  return {
    state: "RETRY_SCHEDULED",
    nextAttemptAt: nextWebhookAttemptAt(input.attemptCount, input.now ?? new Date()),
    errorCategory,
  };
}

export function webhookDeliveryHealth(input: {
  active: boolean;
  consecutiveFailures: number;
  lastDeliveryStatus?: number | null;
  deadLetterCount?: number;
}): "HEALTHY" | "DEGRADED" | "FAILING" | "DISABLED" {
  if (!input.active) return "DISABLED";
  if ((input.deadLetterCount ?? 0) > 0 || input.consecutiveFailures >= 5) return "FAILING";
  if (input.consecutiveFailures > 0 || (input.lastDeliveryStatus != null && (input.lastDeliveryStatus < 200 || input.lastDeliveryStatus >= 300))) return "DEGRADED";
  return "HEALTHY";
}
