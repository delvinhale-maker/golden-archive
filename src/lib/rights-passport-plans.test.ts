import { describe, it, expect } from "bun:test";
import {
  RIGHTS_PASSPORT_PLANS,
  PLAN_CAPABILITY_LIMITS,
  checkRightsPassportCapability,
  DEFAULT_RIGHTS_PASSPORT_PLAN,
  type RightsPassportCapability,
} from "./rights-passport-plans";

const ALL_CAPABILITIES: RightsPassportCapability[] = [
  "ACTIVE_PASSPORTS",
  "DOCUMENT_UPLOADS_PER_PASSPORT",
  "AI_ANALYSES_PER_MONTH",
  "STORAGE_MB",
  "PUBLIC_PUBLISH",
  "PDF_EXPORTS",
  "JSON_EXPORTS",
  "PRIVATE_OWNER_EXPORTS",
  "VERSION_HISTORY_DEPTH",
  "ADVANCED_CONFLICT_ANALYSIS",
  "MANAGED_IDENTITIES",
];

describe("PLAN_CAPABILITY_LIMITS — every plan defines every capability", () => {
  it("has no missing capability for any plan (would be a silent implicit-allow gap)", () => {
    for (const plan of RIGHTS_PASSPORT_PLANS) {
      for (const capability of ALL_CAPABILITIES) {
        expect(PLAN_CAPABILITY_LIMITS[plan][capability]).toBeDefined();
      }
    }
  });

  it("default plan (FREE_PREVIEW) is the most restrictive tier", () => {
    expect(DEFAULT_RIGHTS_PASSPORT_PLAN).toBe("FREE_PREVIEW");
    expect(PLAN_CAPABILITY_LIMITS.FREE_PREVIEW.PUBLIC_PUBLISH).toBe(false);
    expect(PLAN_CAPABILITY_LIMITS.FREE_PREVIEW.PDF_EXPORTS).toBe(false);
    expect(PLAN_CAPABILITY_LIMITS.FREE_PREVIEW.JSON_EXPORTS).toBe(false);
  });

  it("no plan grants a boolean capability that a lower plan also lacks in an inconsistent order (BUSINESS >= PROFESSIONAL >= PERSONAL for every numeric cap)", () => {
    const order: (keyof typeof PLAN_CAPABILITY_LIMITS)[] = [
      "FREE_PREVIEW",
      "PERSONAL",
      "PROFESSIONAL",
      "BUSINESS",
    ];
    for (const capability of ALL_CAPABILITIES) {
      let prev: number | null = null;
      for (const plan of order) {
        const limit = PLAN_CAPABILITY_LIMITS[plan][capability];
        if (typeof limit === "number") {
          if (prev !== null) expect(limit).toBeGreaterThanOrEqual(prev);
          prev = limit;
        }
      }
    }
  });
});

describe("checkRightsPassportCapability — boolean capabilities", () => {
  it("denies with PLAN_DOES_NOT_INCLUDE when the plan's capability is false", () => {
    const result = checkRightsPassportCapability("FREE_PREVIEW", "PUBLIC_PUBLISH");
    expect(result.allowed).toBe(false);
    expect(result).toMatchObject({ reason: "PLAN_DOES_NOT_INCLUDE" });
  });

  it("allows when the plan's capability is true, regardless of usage", () => {
    const result = checkRightsPassportCapability("PERSONAL", "PUBLIC_PUBLISH", 999);
    expect(result.allowed).toBe(true);
  });
});

describe("checkRightsPassportCapability — numeric capabilities", () => {
  it("allows when usage is below the limit", () => {
    const result = checkRightsPassportCapability("PERSONAL", "ACTIVE_PASSPORTS", 0);
    expect(result.allowed).toBe(true);
  });

  it("denies with LIMIT_REACHED when usage meets the limit", () => {
    const result = checkRightsPassportCapability("PERSONAL", "ACTIVE_PASSPORTS", 1);
    expect(result.allowed).toBe(false);
    expect(result).toMatchObject({ reason: "LIMIT_REACHED" });
  });

  it("denies when usage exceeds the limit", () => {
    const result = checkRightsPassportCapability(
      "FREE_PREVIEW",
      "DOCUMENT_UPLOADS_PER_PASSPORT",
      5,
    );
    expect(result.allowed).toBe(false);
  });

  it("BUSINESS plan allows meaningfully higher usage than FREE_PREVIEW for the same capability", () => {
    expect(checkRightsPassportCapability("BUSINESS", "AI_ANALYSES_PER_MONTH", 10).allowed).toBe(
      true,
    );
    expect(checkRightsPassportCapability("FREE_PREVIEW", "AI_ANALYSES_PER_MONTH", 10).allowed).toBe(
      false,
    );
  });
});
