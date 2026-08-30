import { describe, it, expect } from "bun:test";
import {
  serializePublicPassport,
  serializePrivatePassport,
  PUBLIC_VERIFICATION_LABELS,
  PUBLIC_AI_PERMISSION_LABELS,
  type SerializeInput,
} from "./rights-passport-serialize";

const SENTINEL_LEGAL_NAME = "PRIVATE_LEGAL_NAME_DO_NOT_EXPORT";
// Storage-adjacent identifiers (file_url/hash_fingerprint) — must never
// appear in EITHER serializer's output, since neither is "passport data,"
// they're Round 3 document-storage artifacts.
const SENTINEL_STORAGE_PATH = "PRIVATE_STORAGE_PATH_DO_NOT_EXPORT";
// Owner-authored free-text notes — legitimate PRIVATE-export content (the
// owner's own business notes about their own records), distinct from "raw
// contract text" (Round 3's extracted document content, which has no input
// field on SerializeInput at all — there is no code path for it to leak
// through even in the private export). Expected to appear in private
// output, never in public.
const SENTINEL_OWNER_NOTES = "OWNER_AUTHORED_NOTES_PRIVATE_ONLY";
const SENTINEL_PRIVATE_NOTES = "PRIVATE_NOTES_DO_NOT_EXPORT";
const SENTINEL_REP_CONTACT = "PRIVATE_REP_CONTACT_DO_NOT_EXPORT";
const SENTINEL_SUCCESSOR = "PRIVATE_SUCCESSOR_CONTACT_DO_NOT_EXPORT";
const SENTINEL_COMPENSATION = "PRIVATE_COMPENSATION_DO_NOT_EXPORT";
const SENTINEL_CLAIMED_CONTROLLER = "PRIVATE_CLAIMED_CONTROLLER_DO_NOT_EXPORT";
const SENTINEL_REGISTRATION_ID = "PRIVATE_REGISTRATION_ID_DO_NOT_EXPORT";
const SENTINEL_HASH_FINGERPRINT = "PRIVATE_HASH_FINGERPRINT_DO_NOT_EXPORT";
const SENTINEL_EVIDENCE_LOCATION_TEXT = "OWNER_ENTERED_EVIDENCE_LOCATION_TEXT";

function poisonedInput(overrides: Partial<SerializeInput> = {}): SerializeInput {
  return {
    publicId: "drp_test123",
    passportVersion: 3,
    status: "ACTIVE",
    publishedAt: "2026-01-01T00:00:00.000Z",
    effectiveAt: "2026-01-01",
    humanReadableUrl: "https://aurumvault.store/rights/drp_test123",
    passport: {
      public_professional_name: "Jordan Rivers",
      legal_name: SENTINEL_LEGAL_NAME,
      stage_brand_name: "J. Rivers",
      primary_role: "Recording Artist",
      jurisdiction: "New York",
      rights_contact_email: "rights@example.com",
      rights_entity: "Rivers Media LLC",
      public_rights_url: "https://example.com/rights",
      verification_level: "DOCUMENT_SUPPORTED",
      representative_name: "Agent Name",
      representative_contact: SENTINEL_REP_CONTACT,
      agent_manager_name: "Manager Name",
      agent_manager_contact: SENTINEL_REP_CONTACT,
      successor_estate_contact: SENTINEL_SUCCESSOR,
      effective_date: "2026-01-01",
      review_frequency: "Annually",
      public_notes: "Public-safe note",
      private_notes: SENTINEL_PRIVATE_NOTES,
    },
    assets: [
      {
        name: "Public Voice Asset",
        asset_type: "VOICE",
        territory: "Worldwide",
        is_public: true,
        default_ai_policy: "PROHIBIT",
        default_license_policy: "Contact for license",
        claimed_owner_controller: SENTINEL_CLAIMED_CONTROLLER,
        control_basis: "CREATORSHIP",
        registration_identifier: SENTINEL_REGISTRATION_ID,
        evidence_location: SENTINEL_EVIDENCE_LOCATION_TEXT,
        representative: SENTINEL_REP_CONTACT,
        notes: SENTINEL_OWNER_NOTES,
      },
      {
        name: "Private Asset (not public)",
        asset_type: "NAME",
        territory: "Worldwide",
        is_public: false,
        default_ai_policy: "ALLOW",
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
        compensation_rule: SENTINEL_COMPENSATION,
        evidence_reference: SENTINEL_OWNER_NOTES,
        license_contact: SENTINEL_REP_CONTACT,
        notes: SENTINEL_OWNER_NOTES,
      },
      {
        asset_id: null,
        use_case: "POSTHUMOUS_ESTATE_USE",
        permission: "CASE_BY_CASE",
        compensation_rule: null,
        evidence_reference: null,
        license_contact: null,
        notes: null,
      },
    ],
    licenses: [
      {
        status: "ACTIVE",
        is_exclusive: true,
        compensation: SENTINEL_COMPENSATION,
        notes: SENTINEL_OWNER_NOTES,
      },
    ],
    evidence: [
      {
        evidence_type: "CONTRACT",
        status: "SELF_DECLARED",
        source_creator: "Rivers Media LLC",
        file_url: SENTINEL_STORAGE_PATH,
        hash_fingerprint: SENTINEL_HASH_FINGERPRINT,
        notes: SENTINEL_OWNER_NOTES,
      },
      {
        evidence_type: "IDENTITY_DOCUMENT",
        status: "VERIFIED",
        source_creator: SENTINEL_LEGAL_NAME,
        file_url: SENTINEL_STORAGE_PATH,
        hash_fingerprint: SENTINEL_HASH_FINGERPRINT,
        notes: SENTINEL_OWNER_NOTES,
      },
    ],
    ...overrides,
  };
}

describe("serializePublicPassport — sentinel injection (spec §N/§Q)", () => {
  it("never includes the sentinel values anywhere in the serialized JSON string", () => {
    const payload = serializePublicPassport(poisonedInput());
    const json = JSON.stringify(payload);
    for (const sentinel of [
      SENTINEL_LEGAL_NAME,
      SENTINEL_STORAGE_PATH,
      SENTINEL_OWNER_NOTES,
      SENTINEL_PRIVATE_NOTES,
      SENTINEL_REP_CONTACT,
      SENTINEL_SUCCESSOR,
      SENTINEL_COMPENSATION,
      SENTINEL_CLAIMED_CONTROLLER,
      SENTINEL_REGISTRATION_ID,
      SENTINEL_HASH_FINGERPRINT,
    ]) {
      expect(json).not.toContain(sentinel);
    }
  });

  it("never includes the real internal passport identifiers — passport_id is the opaque public_id only", () => {
    const payload = serializePublicPassport(poisonedInput());
    expect(payload.passport.passport_id).toBe("drp_test123");
    expect(JSON.stringify(payload)).not.toContain("passport_key");
  });

  it("excludes the non-public asset entirely — only is_public:true assets appear", () => {
    const payload = serializePublicPassport(poisonedInput());
    expect(payload.assets.length).toBe(1);
    expect(payload.assets[0].name).toBe("Public Voice Asset");
    expect(JSON.stringify(payload)).not.toContain("Private Asset (not public)");
  });

  it("excludes IDENTITY_DOCUMENT evidence entirely from provenance", () => {
    const payload = serializePublicPassport(poisonedInput());
    expect(payload.provenance.every((p) => p.evidence_type !== "IDENTITY_DOCUMENT")).toBe(true);
    expect(payload.provenance.length).toBe(1);
  });

  it("never includes actual license records — only a non-confidential license_notice string", () => {
    const payload = serializePublicPassport(poisonedInput());
    expect(payload.license_notice).toBe(
      "One or more existing licensing agreements may affect these declared defaults.",
    );
    expect((payload as any).licenses).toBeUndefined();
  });

  it("license_notice is null when there are no licenses on record", () => {
    const payload = serializePublicPassport(poisonedInput({ licenses: [] }));
    expect(payload.license_notice).toBeNull();
  });

  it("normalizes AI permission enums to public labels, never raw enum strings", () => {
    const payload = serializePublicPassport(poisonedInput());
    const voiceClone = payload.ai_permissions.find((p) => p.use_case === "VOICE_CLONE");
    expect(voiceClone?.permission).toBe("PROHIBITED");
    expect(JSON.stringify(payload)).not.toContain('"PROHIBIT"');
  });

  it("normalizes verification level to the public label, never GOVERNMENT VERIFIED / LEGAL VERIFIED / OFFICIALLY CERTIFIED", () => {
    const payload = serializePublicPassport(poisonedInput());
    expect(payload.subject.verification_level).toBe("DOCUMENT-SUPPORTED");
    const json = JSON.stringify(payload).toUpperCase();
    expect(json).not.toContain("GOVERNMENT VERIFIED");
    expect(json).not.toContain("LEGAL VERIFIED");
    expect(json).not.toContain("OFFICIALLY CERTIFIED");
  });

  it("legacy summary exposes only a boolean for successor planning, never the actual contact value", () => {
    const payload = serializePublicPassport(poisonedInput());
    expect(payload.legacy.successor_planning_on_file).toBe(true);
    expect(JSON.stringify(payload.legacy)).not.toContain(SENTINEL_SUCCESSOR);
  });

  it("posthumous AI use reflects the passport-wide declared permission label", () => {
    const payload = serializePublicPassport(poisonedInput());
    expect(payload.legacy.posthumous_ai_use).toBe("CASE-BY-CASE");
  });

  it("posthumous AI use is NOT DECLARED when no passport-wide consent exists for it", () => {
    const payload = serializePublicPassport(
      poisonedInput({
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
      }),
    );
    expect(payload.legacy.posthumous_ai_use).toBe("NOT DECLARED");
  });

  it("includes the required public rights statement and interoperability notice verbatim", () => {
    const payload = serializePublicPassport(poisonedInput());
    expect(payload.notices.legal_effect).toContain(
      "does not itself establish legal ownership, government registration, or legal enforceability",
    );
    expect(payload.notices.standards).not.toMatch(/C2PA compliant|W3C certified|NIST approved/i);
  });

  it("excludes asset-level AI consents from ai_permissions — only passport-wide (asset_id null) entries", () => {
    const payload = serializePublicPassport(
      poisonedInput({
        aiConsents: [
          {
            asset_id: "some-asset-id",
            use_case: "VOICE_CLONE",
            permission: "ALLOW",
            compensation_rule: null,
            evidence_reference: null,
            license_contact: null,
            notes: null,
          },
        ],
      }),
    );
    expect(payload.ai_permissions.length).toBe(0);
  });
});

describe("serializePrivatePassport — owner-only detail, still no raw contract/storage artifacts", () => {
  it("includes legal_name and other private identity fields for the owner's own copy", () => {
    const payload = serializePrivatePassport(poisonedInput());
    expect(payload.private.legal_name).toBe(SENTINEL_LEGAL_NAME);
    expect(payload.private.successor_estate_contact).toBe(SENTINEL_SUCCESSOR);
  });

  it("still never includes storage paths or hash fingerprints — those are Round 3 document-storage artifacts, not passport data, even in the private export", () => {
    const payload = serializePrivatePassport(poisonedInput());
    const json = JSON.stringify(payload);
    expect(json).not.toContain(SENTINEL_STORAGE_PATH);
    expect(json).not.toContain(SENTINEL_HASH_FINGERPRINT);
  });

  it("does include the owner's own free-text notes and evidence-location text — legitimate private-export detail, distinct from raw contract text", () => {
    const payload = serializePrivatePassport(poisonedInput());
    const json = JSON.stringify(payload);
    expect(json).toContain(SENTINEL_OWNER_NOTES);
    expect(json).toContain(SENTINEL_EVIDENCE_LOCATION_TEXT);
  });

  it("owner notes never leak into the PUBLIC serializer's output even though they're private-export-safe", () => {
    const payload = serializePublicPassport(poisonedInput());
    expect(JSON.stringify(payload)).not.toContain(SENTINEL_OWNER_NOTES);
  });

  it("private export's public-mirrored section is byte-identical to what serializePublicPassport would produce on its own", () => {
    const input = poisonedInput();
    const pub = serializePublicPassport(input);
    const priv = serializePrivatePassport(input);
    expect(priv.passport).toEqual(pub.passport);
    expect(priv.subject).toEqual(pub.subject);
    expect(priv.assets).toEqual(pub.assets);
  });

  it("includes non-public assets too, unlike the public serializer", () => {
    const payload = serializePrivatePassport(poisonedInput());
    expect(payload.private.assets.length).toBe(2);
  });
});

describe("label maps — completeness", () => {
  it("PUBLIC_VERIFICATION_LABELS covers all 4 verification levels", () => {
    expect(Object.keys(PUBLIC_VERIFICATION_LABELS).length).toBe(4);
  });

  it("PUBLIC_AI_PERMISSION_LABELS covers all 6 AI policy values", () => {
    expect(Object.keys(PUBLIC_AI_PERMISSION_LABELS).length).toBe(6);
  });
});
