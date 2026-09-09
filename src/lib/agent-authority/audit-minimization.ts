const SENSITIVE_KEY = /(^|[_-])(password|passwd|secret|token|authorization|cookie|credential|api[_-]?key|private[_-]?key|session|raw[_-]?body|card|cvv|ssn|access[_-]?token|refresh[_-]?token)($|[_-])/i;
const MAX_STRING = 512;
const MAX_KEYS = 40;
const MAX_ARRAY = 25;
const MAX_DEPTH = 4;

export type SanitizedAuditValue = null | boolean | number | string | SanitizedAuditValue[] | { [key: string]: SanitizedAuditValue };

function sanitize(value: unknown, depth: number): SanitizedAuditValue {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[truncated]` : value;
  if (depth >= MAX_DEPTH) return "[depth-limited]";
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object") {
    const result: Record<string, SanitizedAuditValue> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
      result[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitize(nested, depth + 1);
    }
    return result;
  }
  return String(value).slice(0, MAX_STRING);
}

export function minimizeAuditMetadata(metadata: Record<string, unknown> | undefined | null): Record<string, SanitizedAuditValue> {
  return sanitize(metadata ?? {}, 0) as Record<string, SanitizedAuditValue>;
}
