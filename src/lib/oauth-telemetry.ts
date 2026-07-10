// Structured client-side logging for OAuth (Google) failures.
// Emits PII-safe events with correlation IDs so we can trace a single attempt
// across console logs and the Lovable error reporter.
//
// SAFETY: never log email, password, tokens, full URLs with query params,
// or raw error objects that may contain bearer tokens.

import { reportLovableError } from "./lovable-error-reporting";

export type OAuthFailureReason =
  | "popupBlocked"
  | "cancelled"
  | "network"
  | "noSession"
  | "cookiesBlocked"
  | "storageBlocked"
  | "redirectMismatch"
  | "unknown";


export type OAuthProvider = "google" | "apple" | "microsoft" | "lovable";

const CORRELATION_KEY = "av_oauth_correlation_id";

function rand(): string {
  // RFC4122-ish v4 without depending on crypto.randomUUID (older iOS Safari).
  const c =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto
      : undefined;
  if (c && "randomUUID" in c) {
    try {
      return (c as Crypto).randomUUID();
    } catch {
      /* fall through */
    }
  }
  const bytes = new Uint8Array(16);
  if (c) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Start a new OAuth attempt; returns a correlation ID stored for the round-trip. */
export function beginOAuthAttempt(provider: OAuthProvider): string {
  const id = rand();
  try {
    sessionStorage.setItem(CORRELATION_KEY, id);
  } catch {
    /* storage may be unavailable in private mode */
  }
  logOAuthEvent({
    level: "info",
    provider,
    correlationId: id,
    event: "oauth.start",
  });
  return id;
}

/** Retrieve the active correlation ID, if any. */
export function getOAuthCorrelationId(): string | undefined {
  try {
    return sessionStorage.getItem(CORRELATION_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function clearOAuthCorrelationId(): void {
  try {
    sessionStorage.removeItem(CORRELATION_KEY);
  } catch {
    /* ignore */
  }
}

/** Hash a short, non-reversible session marker (first 8 hex chars). PII-safe. */
export function sessionMarker(token?: string | null): string | undefined {
  if (!token) return undefined;
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

type OAuthEvent = {
  level: "info" | "warn" | "error";
  provider: OAuthProvider;
  correlationId: string | undefined;
  event: string;
  reason?: OAuthFailureReason;
  // Sanitized, non-sensitive metadata only:
  meta?: Record<string, string | number | boolean | undefined>;
};

const REASON_TO_CODE: Record<OAuthFailureReason, string> = {
  popupBlocked: "POPUP_BLOCKED",
  cancelled: "USER_CANCELLED",
  network: "NETWORK_ERROR",
  noSession: "NO_SESSION_RETURNED",
  unknown: "UNKNOWN_ERROR",
};

const SENSITIVE = /(token|secret|password|email|authorization|cookie|code=|id_token)/i;

function sanitizeMessage(msg: unknown): string | undefined {
  if (msg == null) return undefined;
  const s = typeof msg === "string" ? msg : String(msg);
  if (SENSITIVE.test(s)) return "[redacted]";
  // Trim to keep logs small.
  return s.length > 240 ? `${s.slice(0, 240)}…` : s;
}

/** Emit a structured OAuth log entry. */
export function logOAuthEvent(evt: OAuthEvent): void {
  const payload = {
    ns: "oauth",
    ts: new Date().toISOString(),
    level: evt.level,
    provider: evt.provider,
    event: evt.event,
    correlation_id: evt.correlationId,
    reason: evt.reason,
    code: evt.reason ? REASON_TO_CODE[evt.reason] : undefined,
    ...evt.meta,
  };
  const line = `[oauth] ${evt.event}${evt.reason ? `:${evt.reason}` : ""}`;
  if (evt.level === "error") console.error(line, payload);
  else if (evt.level === "warn") console.warn(line, payload);
  else console.info(line, payload);
}

/** Convenience for failures — also forwards to Lovable's error reporter. */
export function logOAuthFailure(args: {
  provider: OAuthProvider;
  reason: OAuthFailureReason;
  rawMessage?: unknown;
  meta?: OAuthEvent["meta"];
}): string | undefined {
  const correlationId = getOAuthCorrelationId();
  const safeMessage = sanitizeMessage(args.rawMessage);
  logOAuthEvent({
    level: args.reason === "cancelled" ? "warn" : "error",
    provider: args.provider,
    correlationId,
    event: "oauth.failure",
    reason: args.reason,
    meta: { ...args.meta, message: safeMessage },
  });
  // Cancellations are user-driven; don't pollute error reporting with them.
  if (args.reason !== "cancelled") {
    reportLovableError(new Error(`oauth.${args.reason}`), {
      source: "oauth",
      provider: args.provider,
      reason: args.reason,
      code: REASON_TO_CODE[args.reason],
      correlation_id: correlationId,
      message: safeMessage,
    });
  }
  return correlationId;
}
