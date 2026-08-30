import { describe, it, expect } from "bun:test";
import {
  RIGHTS_PASSPORT_EVENT_KINDS,
  isValidRightsPassportEventKind,
} from "./rights-passport-events";

describe("RIGHTS_PASSPORT_EVENT_KINDS", () => {
  it("matches exactly the 15 event kinds required by the release spec", () => {
    expect(RIGHTS_PASSPORT_EVENT_KINDS.length).toBe(15);
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_passport_created");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_asset_added");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_ai_consent_updated");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_license_added");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_evidence_added");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_document_uploaded");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_parse_failed");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_analysis_started");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_analysis_pass_failed");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_analysis_completed");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_finding_reviewed");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_publish_blocked");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_passport_published");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_passport_revoked");
    expect(RIGHTS_PASSPORT_EVENT_KINDS).toContain("rights_export_failed");
  });

  it("has no duplicate kinds", () => {
    expect(new Set(RIGHTS_PASSPORT_EVENT_KINDS).size).toBe(RIGHTS_PASSPORT_EVENT_KINDS.length);
  });
});

describe("isValidRightsPassportEventKind", () => {
  it("accepts every declared kind", () => {
    for (const kind of RIGHTS_PASSPORT_EVENT_KINDS) {
      expect(isValidRightsPassportEventKind(kind)).toBe(true);
    }
  });

  it("rejects an arbitrary string", () => {
    expect(isValidRightsPassportEventKind("not_a_real_event")).toBe(false);
    expect(isValidRightsPassportEventKind("")).toBe(false);
  });
});
