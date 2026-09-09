import { createHash } from "node:crypto";
import type { AuthorizationReceiptInput } from "./types";
import { validateEvidenceLevel } from "./receipt";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

export function hashReceipt(input: AuthorizationReceiptInput): string {
  validateEvidenceLevel(input);
  return createHash("sha256").update(JSON.stringify(stable(input))).digest("hex");
}
