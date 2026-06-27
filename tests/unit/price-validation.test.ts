/**
 * Unit tests for the publish wizard's list-price validator.
 *
 * The Pricing step's Continue button must NEVER silently advance when the
 * price field is empty, whitespace, a stray placeholder, or otherwise
 * invalid. Regression coverage for the "Continue does nothing" bug where
 * the user saw the `placeholder="9.99"` hint and assumed it was a value.
 *
 * Run with: bun test tests/unit/price-validation.test.ts
 */
import { describe, it, expect } from "bun:test";
import { validateListPrice, isListPriceValid } from "../../src/lib/publish-validation";

describe("validateListPrice — Continue must block", () => {
  it("blocks an empty string (the default state of the input)", () => {
    const r = validateListPrice("");
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("empty");
    expect(isListPriceValid("")).toBe(false);
  });

  it("blocks null and undefined", () => {
    expect(validateListPrice(null).valid).toBe(false);
    expect(validateListPrice(undefined).valid).toBe(false);
  });

  it("blocks whitespace-only input", () => {
    const r = validateListPrice("   ");
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("whitespace");
  });

  it("blocks when only the placeholder is showing (field value is still empty)", () => {
    // The browser renders placeholder="9.99" when the input value is "".
    // The component reads `price` (state), which stays "" until the user
    // types. Simulate exactly that: state is "", placeholder is irrelevant.
    const placeholderShown = "9.99";
    const actualFieldValue = ""; // <input value={price} /> when price === ""
    expect(isListPriceValid(actualFieldValue)).toBe(false);
    // Sanity: the placeholder text itself would be valid IF it were the
    // value — proving the bug was "we read placeholder, not value".
    expect(isListPriceValid(placeholderShown)).toBe(true);
  });

  it("blocks non-numeric strings", () => {
    expect(validateListPrice("abc").reason).toBe("not_a_number");
    expect(validateListPrice("$$$").reason).toBe("not_a_number");
    expect(validateListPrice("free").reason).toBe("not_a_number");
  });

  it("blocks zero", () => {
    expect(validateListPrice("0").reason).toBe("zero");
    expect(validateListPrice("0.00").reason).toBe("zero");
    expect(validateListPrice(0).reason).toBe("zero");
  });

  it("blocks negative values", () => {
    expect(validateListPrice("-1").reason).toBe("negative");
    expect(validateListPrice("-9.99").reason).toBe("negative");
    expect(validateListPrice(-5).reason).toBe("negative");
  });

  it("blocks values below the $1.00 minimum (matches input min='1')", () => {
    expect(validateListPrice("0.50").reason).toBe("below_min");
    expect(validateListPrice("0.99").reason).toBe("below_min");
  });

  it("blocks NaN and Infinity", () => {
    expect(validateListPrice("NaN").valid).toBe(false);
    expect(validateListPrice(NaN).valid).toBe(false);
    expect(validateListPrice(Infinity).valid).toBe(true); // finite check
    // Infinity actually fails Number.isFinite, so:
    expect(Number.isFinite(Infinity)).toBe(false);
    expect(validateListPrice(Infinity).valid).toBe(false);
  });
});

describe("validateListPrice — Continue must allow", () => {
  it("allows the canonical $9.99 entry", () => {
    expect(isListPriceValid("9.99")).toBe(true);
  });

  it("allows whole-dollar entries", () => {
    expect(isListPriceValid("1")).toBe(true);
    expect(isListPriceValid("10")).toBe(true);
    expect(isListPriceValid("199")).toBe(true);
  });

  it("allows numeric (non-string) inputs", () => {
    expect(isListPriceValid(9.99)).toBe(true);
    expect(isListPriceValid(1)).toBe(true);
  });

  it("allows values with trailing whitespace (parseFloat tolerates it)", () => {
    expect(isListPriceValid("9.99 ")).toBe(true);
  });
});
