import { describe, it, expect } from "vitest";
import {
  validateExportPayload,
  PASSPORT_EXPORT_JSON_SCHEMA,
} from "./rights-passport-export-schema";
import { serializePublicPassport, type SerializeInput } from "./rights-passport-serialize";

function validInput(overrides: Partial<SerializeInput> = {}): SerializeInput {
  return {
    publicId: "drp_abc",
    passportVersion: 1,
    status: "ACTIVE",
    publishedAt: "2026-01-01T00:00:00.000Z",
    effectiveAt: "2026-01-01",
    humanReadableUrl: "https://aurumvault.store/rights/drp_abc",
    passport: {
      public_professional_name: "Jordan Rivers",
      legal_name: "Jordan A. Rivers",
      stage_brand_name: "J. Rivers",
      primary_role: "Recording Artist",
      jurisdiction: "New York",
      rights_contact_email: "rights@example.com",
      rights_entity: "Rivers Media LLC",
      public_rights_url: "https://example.com/rights",
      verification_level: "DOCUMENT_SUPPORTED",
      representative_name: null,
      representative_contact: null,
      agent_manager_name: null,
      agent_manager_contact: null,
      successor_estate_contact: "estate@example.com",
      effective_date: "2026-01-01",
      review_frequency: "Annually",
      public_notes: null,
      private_notes: null,
    },
    assets: [
      {
        name: "Voice",
        asset_type: "VOICE",
        territory: "Worldwide",
        is_public: true,
        default_ai_policy: "PROHIBIT",
        default_license_policy: null,
        claimed_owner_controller: null,
        control_basis: "CREATORSHIP",
        registration_identifier: null,
        evidence_location: null,
        representative: null,
        notes: null,
      },
    ],
    aiConsents: [
      {
        asset_id: null,
        use_case: "VOICE_CLONE",
        permission: "PROHIBIT",
        compensation_rule: null,
        evidence_reference: null,
        license_contact: null,
        notes: null,
      },
    ],
    licenses: [],
    evidence: [],
    ...overrides,
  };
}

describe("validateExportPayload — real generated payload", () => {
  it("a real serializePublicPassport() output validates cleanly against the schema", () => {
    const payload = serializePublicPassport(validInput());
    const result = validateExportPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("validates across several different input shapes (empty assets, no licenses, null optional fields)", () => {
    const payload = serializePublicPassport(
      validInput({
        assets: [],
        aiConsents: [],
        passport: { ...validInput().passport, jurisdiction: null, rights_contact_email: null },
      }),
    );
    expect(validateExportPayload(payload).valid).toBe(true);
  });
});

describe("validateExportPayload — catches real defects", () => {
  it("flags a missing required top-level key", () => {
    const payload = serializePublicPassport(validInput()) as any;
    delete payload.notices;
    const result = validateExportPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "$.notices")).toBe(true);
  });

  it("flags a missing required nested key", () => {
    const payload = serializePublicPassport(validInput()) as any;
    delete payload.passport.schema_version;
    const result = validateExportPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "$.passport.schema_version")).toBe(true);
  });

  it("flags a wrong type on a field", () => {
    const payload = serializePublicPassport(validInput()) as any;
    payload.passport.passport_version = "one";
    const result = validateExportPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "$.passport.passport_version")).toBe(true);
  });

  it("flags a status value outside the enum", () => {
    const payload = serializePublicPassport(validInput()) as any;
    payload.passport.status = "DELETED";
    const result = validateExportPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "$.passport.status")).toBe(true);
  });

  it("flags a malformed item inside the assets array", () => {
    const payload = serializePublicPassport(validInput()) as any;
    payload.assets.push({ name: "Missing fields" });
    const result = validateExportPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path.startsWith("$.assets[1]"))).toBe(true);
  });

  it("rejects a completely empty object", () => {
    expect(validateExportPayload({}).valid).toBe(false);
  });

  it("rejects null and non-object payloads", () => {
    expect(validateExportPayload(null).valid).toBe(false);
    expect(validateExportPayload("not an object").valid).toBe(false);
    expect(validateExportPayload(42).valid).toBe(false);
  });
});

describe("PASSPORT_EXPORT_JSON_SCHEMA", () => {
  it("declares the current schema version and a stable $id", () => {
    expect(PASSPORT_EXPORT_JSON_SCHEMA.$id).toContain("1.0");
  });
});
