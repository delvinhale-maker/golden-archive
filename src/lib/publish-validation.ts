/**
 * Validation helpers for the publish wizard.
 *
 * Extracted from `dashboard.new.tsx` so the rules that gate the
 * Continue button can be unit-tested independently. Any change to
 * Continue-blocking behavior should keep `tests/unit/price-validation.test.ts`
 * passing.
 */

export type PriceValidationResult = {
  valid: boolean;
  reason?:
    | "empty"
    | "whitespace"
    | "not_a_number"
    | "negative"
    | "zero"
    | "below_min";
};

/**
 * Returns whether a price string entered in the Pricing step is valid
 * enough to advance the wizard. Mirrors the rule used by the input's
 * `min="1" step="0.01"` constraints: must parse to a finite number > 0.
 *
 * A placeholder value (the field is empty and the browser is just
 * rendering the `placeholder="9.99"` hint) is treated as "empty" — the
 * user has not actually entered anything.
 */
export function validateListPrice(raw: unknown): PriceValidationResult {
  if (raw === null || raw === undefined) return { valid: false, reason: "empty" };
  if (typeof raw !== "string") {
    // Numbers are coerced; everything else is invalid.
    if (typeof raw === "number" && Number.isFinite(raw)) {
      if (raw === 0) return { valid: false, reason: "zero" };
      if (raw < 0) return { valid: false, reason: "negative" };
      return { valid: true };
    }
    return { valid: false, reason: "not_a_number" };
  }

  if (raw.length === 0) return { valid: false, reason: "empty" };
  if (raw.trim().length === 0) return { valid: false, reason: "whitespace" };

  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed)) return { valid: false, reason: "not_a_number" };
  if (parsed < 0) return { valid: false, reason: "negative" };
  if (parsed === 0) return { valid: false, reason: "zero" };
  // `min="1"` on the input — anything between 0 and 1 should also block.
  if (parsed < 1) return { valid: false, reason: "below_min" };

  return { valid: true };
}

/**
 * Convenience boolean form used by the wizard's `step3Valid` flag.
 */
export function isListPriceValid(raw: unknown): boolean {
  return validateListPrice(raw).valid;
}
