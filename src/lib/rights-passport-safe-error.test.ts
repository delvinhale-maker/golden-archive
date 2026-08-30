import { describe, it, expect } from "bun:test";
import { sanitizeDbErrorMessage, SAFE_GENERIC_ERROR_MESSAGE } from "./rights-passport-safe-error";

describe("sanitizeDbErrorMessage — strips raw Postgres/PostgREST internals", () => {
  it("replaces a unique-constraint violation with the safe generic message", () => {
    expect(
      sanitizeDbErrorMessage(
        'duplicate key value violates unique constraint "rights_ai_consents_unique_scope"',
      ),
    ).toBe(SAFE_GENERIC_ERROR_MESSAGE);
  });

  it("replaces a check-constraint violation", () => {
    expect(
      sanitizeDbErrorMessage(
        'new row for relation "rights_passport_documents" violates check constraint "rights_passport_documents_mime_allowed"',
      ),
    ).toBe(SAFE_GENERIC_ERROR_MESSAGE);
  });

  it("replaces a missing-relation error", () => {
    expect(sanitizeDbErrorMessage('relation "rights_passports_typo" does not exist')).toBe(
      SAFE_GENERIC_ERROR_MESSAGE,
    );
  });

  it("replaces a column-name-leaking error", () => {
    expect(sanitizeDbErrorMessage('column "owner_user_id" does not exist')).toBe(
      SAFE_GENERIC_ERROR_MESSAGE,
    );
  });

  it("replaces an RLS-denial error", () => {
    expect(
      sanitizeDbErrorMessage(
        'new row violates row-level security policy for table "rights_passports"',
      ),
    ).toBe(SAFE_GENERIC_ERROR_MESSAGE);
  });

  it("replaces a permission-denied error", () => {
    expect(sanitizeDbErrorMessage("permission denied for table rights_passports")).toBe(
      SAFE_GENERIC_ERROR_MESSAGE,
    );
  });

  it("replaces an invalid-input-syntax error", () => {
    expect(sanitizeDbErrorMessage('invalid input syntax for type uuid: "not-a-uuid"')).toBe(
      SAFE_GENERIC_ERROR_MESSAGE,
    );
  });
});

describe("sanitizeDbErrorMessage — passes through already-safe messages", () => {
  it("leaves a hand-authored guard-trigger message unchanged", () => {
    const msg = "Rights passport ownership cannot be reassigned";
    expect(sanitizeDbErrorMessage(msg)).toBe(msg);
  });

  it("leaves an application-authored quota message unchanged", () => {
    const msg = "You've reached the active passport limit for your plan.";
    expect(sanitizeDbErrorMessage(msg)).toBe(msg);
  });

  it("leaves an application-authored parse-failure message unchanged", () => {
    const msg = "Couldn't read this PDF. It may be corrupted or password-protected.";
    expect(sanitizeDbErrorMessage(msg)).toBe(msg);
  });
});

describe("sanitizeDbErrorMessage — null/empty handling", () => {
  it("returns the safe generic message for null, undefined, or empty input", () => {
    expect(sanitizeDbErrorMessage(null)).toBe(SAFE_GENERIC_ERROR_MESSAGE);
    expect(sanitizeDbErrorMessage(undefined)).toBe(SAFE_GENERIC_ERROR_MESSAGE);
    expect(sanitizeDbErrorMessage("")).toBe(SAFE_GENERIC_ERROR_MESSAGE);
  });
});
