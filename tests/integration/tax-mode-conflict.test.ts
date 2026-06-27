/**
 * Unit tests for the loud-conflict behavior of applyTaxMode +
 * assertTaxModeInvariant. These guard against silent corrections that
 * have historically masked real checkout-builder bugs.
 *
 * Run with: bun test tests/integration/tax-mode-conflict.test.ts
 */
import { describe, it, expect, spyOn } from "bun:test";

process.env.STRIPE_SANDBOX_API_KEY ??= "x";
process.env.STRIPE_LIVE_API_KEY ??= "x";
process.env.LOVABLE_API_KEY ??= "x";

const {
  applyTaxMode,
  assertTaxModeInvariant,
  TaxModeConflictError,
} = await import("@/lib/stripe.server");

describe("applyTaxMode conflict detection", () => {
  it("throws when both managed_payments and automatic_tax are pre-set", () => {
    const errSpy = spyOn(console, "error").mockImplementation(() => {});
    const params = {
      managed_payments: { enabled: true },
      automatic_tax: { enabled: true },
    };
    expect(() => applyTaxMode(params, "managed")).toThrow(TaxModeConflictError);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("throws when mode=managed but caller pre-set automatic_tax", () => {
    const errSpy = spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      applyTaxMode({ automatic_tax: { enabled: true } }, "managed"),
    ).toThrow(/automatic_tax/);
    errSpy.mockRestore();
  });

  it("throws when mode=automatic but caller pre-set managed_payments", () => {
    const errSpy = spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      applyTaxMode({ managed_payments: { enabled: true } }, "automatic"),
    ).toThrow(/managed_payments/);
    errSpy.mockRestore();
  });

  it("applies managed cleanly when no conflict", () => {
    const out = applyTaxMode({ line_items: [] }, "managed");
    expect(out.managed_payments).toEqual({ enabled: true });
    expect((out as any).automatic_tax).toBeUndefined();
  });

  it("applies automatic cleanly when no conflict", () => {
    const out = applyTaxMode({ line_items: [] }, "automatic");
    expect(out.automatic_tax).toEqual({ enabled: true });
    expect((out as any).managed_payments).toBeUndefined();
  });
});

describe("assertTaxModeInvariant", () => {
  it("passes when exactly one field matches the mode", () => {
    expect(() =>
      assertTaxModeInvariant({ managed_payments: { enabled: true } }, "managed"),
    ).not.toThrow();
    expect(() =>
      assertTaxModeInvariant({ automatic_tax: { enabled: true } }, "automatic"),
    ).not.toThrow();
  });

  it("throws when the required field is missing", () => {
    expect(() => assertTaxModeInvariant({}, "managed")).toThrow(
      TaxModeConflictError,
    );
    expect(() => assertTaxModeInvariant({}, "automatic")).toThrow(
      TaxModeConflictError,
    );
  });

  it("throws when both fields end up on the session", () => {
    const errSpy = spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      assertTaxModeInvariant(
        {
          managed_payments: { enabled: true },
          automatic_tax: { enabled: true },
        },
        "managed",
      ),
    ).toThrow(TaxModeConflictError);
    errSpy.mockRestore();
  });
});
