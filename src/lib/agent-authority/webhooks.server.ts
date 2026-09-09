import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const AUTHORITY_WEBHOOK_EVENTS = [
  "decision.created",
  "approval.requested",
  "approval.decided",
  "receipt.created",
  "passport.suspended",
  "passport.reinstated",
  "passport.expired",
  "review.due",
  "policy.change_requested",
  "policy.change_decided",
  "incident.created",
  "incident.contained",
  "incident.closed",
  "delegation.created",
  "delegation.revoked",
] as const;
export type AuthorityWebhookEvent = (typeof AUTHORITY_WEBHOOK_EVENTS)[number];

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

export function webhookReplayFingerprint(body: string, timestamp: string, signatureHeader: string): string {
  return createHash("sha256").update(`${timestamp}.${signatureHeader}.${body}`, "utf8").digest("hex");
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
  const toleranceSeconds = Math.max(1, Math.min(input.toleranceSeconds ?? 300, 900));
  if (!/^\d{10,13}$/.test(input.timestamp) || !input.signatureHeader.startsWith("v1=")) {
    return { valid: false, reason: "MALFORMED" };
  }
  const timestamp = Number(input.timestamp);
  if (!Number.isSafeInteger(timestamp)) return { valid: false, reason: "MALFORMED" };
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

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
}

export function validateWebhookEndpointUrl(raw: string): string {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error("Webhook URL is invalid"); }
  if (parsed.protocol !== "https:") throw new Error("Webhook URL must use HTTPS");
  if (parsed.username || parsed.password) throw new Error("Webhook URL cannot contain embedded credentials");
  if (parsed.port && parsed.port !== "443") throw new Error("Webhook URL must use the standard HTTPS port");
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname === "metadata.google.internal") {
    throw new Error("Webhook URL must target a public HTTPS host");
  }
  if (hostname === "::1" || hostname.startsWith("fe80:") || hostname.startsWith("fc") || hostname.startsWith("fd") || isPrivateIpv4(hostname)) {
    throw new Error("Webhook URL cannot target loopback, link-local, or private networks");
  }
  parsed.hash = "";
  return parsed.toString();
}

export function validateWebhookSubscriptions(events: string[]): AuthorityWebhookEvent[] {
  const unique = [...new Set(events)];
  if (unique.length < 1 || unique.length > AUTHORITY_WEBHOOK_EVENTS.length) throw new Error("At least one supported webhook event is required");
  const allowed = new Set<string>(AUTHORITY_WEBHOOK_EVENTS);
  if (unique.some((event) => !allowed.has(event))) throw new Error("Webhook subscription contains an unsupported event");
  return unique as AuthorityWebhookEvent[];
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
