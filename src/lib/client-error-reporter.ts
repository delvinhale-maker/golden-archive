// Browser-only helper that forwards runtime errors to the server log.
// Safe to call from anywhere on the client; quietly no-ops on the server.
import { logError } from "@/lib/error-monitor.functions";

type Severity = "warn" | "error" | "fatal";
type Source = "client" | "boundary" | "unhandled_rejection" | "window_error";

// In-memory dedupe so a runaway error loop doesn't flood the network.
const seen = new Map<string, number>();
const DEDUPE_MS = 30_000;

function shouldSkip(key: string) {
  const now = Date.now();
  const last = seen.get(key);
  if (last && now - last < DEDUPE_MS) return true;
  seen.set(key, now);
  // Garbage collect old keys
  if (seen.size > 200) {
    for (const [k, t] of seen) if (now - t > DEDUPE_MS * 4) seen.delete(k);
  }
  return false;
}

export function reportClientError(err: unknown, opts: { source?: Source; severity?: Severity; context?: Record<string, unknown> } = {}) {
  if (typeof window === "undefined") return;
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
  const stack = err instanceof Error ? err.stack ?? null : null;
  const key = `${opts.source ?? "client"}|${message.slice(0, 120)}`;
  if (shouldSkip(key)) return;

  void logError({
    data: {
      message,
      stack,
      source: opts.source ?? "client",
      severity: opts.severity ?? "error",
      route: window.location.pathname,
      url: window.location.href,
      userAgent: navigator.userAgent,
      context: opts.context,
    },
  }).catch(() => {
    /* never let reporting throw */
  });
}

let installed = false;
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  window.addEventListener("error", (event) => {
    reportClientError(event.error ?? event.message, {
      source: "window_error",
      severity: "error",
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, {
      source: "unhandled_rejection",
      severity: "error",
    });
  });
}
