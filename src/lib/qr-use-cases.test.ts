import { describe, it, expect } from "bun:test";
import { QR_USE_CASES, QR_USE_CASE_IDS, getQrUseCase } from "./qr-use-cases";
import { QR_NICHES, QR_NICHE_IDS, getQrNiche } from "./qr-niches";
import { QR_DESTINATION_TYPES, QR_MODES } from "./qr";

describe("QR_USE_CASES — config integrity", () => {
  it("has exactly one entry per declared ID, no duplicates or drift", () => {
    const keys = Object.keys(QR_USE_CASES).sort();
    const ids = [...QR_USE_CASE_IDS].sort();
    expect(keys).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every use case's own id field matches its map key", () => {
    for (const [key, uc] of Object.entries(QR_USE_CASES)) {
      expect(uc.id).toBe(key);
    }
  });

  it("every destinationType is a valid QrDestinationType", () => {
    for (const uc of Object.values(QR_USE_CASES)) {
      expect(QR_DESTINATION_TYPES).toContain(uc.destinationType);
    }
  });

  it("every suggestedMode is a valid QrMode", () => {
    for (const uc of Object.values(QR_USE_CASES)) {
      expect(QR_MODES).toContain(uc.suggestedMode);
    }
  });

  it("every supportedNiches entry is a real niche id", () => {
    for (const uc of Object.values(QR_USE_CASES)) {
      for (const nicheId of uc.supportedNiches) {
        expect(QR_NICHE_IDS).toContain(nicheId);
      }
    }
  });

  it("every use case has at least one CTA example and non-empty label/description", () => {
    for (const uc of Object.values(QR_USE_CASES)) {
      expect(uc.ctaExamples.length).toBeGreaterThan(0);
      expect(uc.label.trim().length).toBeGreaterThan(0);
      expect(uc.description.trim().length).toBeGreaterThan(0);
      expect(uc.helperCopy.trim().length).toBeGreaterThan(0);
    }
  });

  it("getQrUseCase returns the matching entry, undefined for unknown ids", () => {
    expect(getQrUseCase("booking")?.label).toBe("Book an Appointment");
    expect(getQrUseCase("not-a-real-id")).toBeUndefined();
  });
});

describe("QR_NICHES — config integrity", () => {
  it("has exactly the four Phase 2 niches, no duplicates or drift", () => {
    const keys = Object.keys(QR_NICHES).sort();
    const ids = [...QR_NICHE_IDS].sort();
    expect(keys).toEqual(ids);
    expect(ids).toEqual(["beauty_salon", "creator", "real_estate", "small_business"].sort());
  });

  it("every niche's own id field matches its map key", () => {
    for (const [key, niche] of Object.entries(QR_NICHES)) {
      expect(niche.id).toBe(key);
    }
  });

  it("every useCaseIds entry references a real, existing use case", () => {
    for (const niche of Object.values(QR_NICHES)) {
      expect(niche.useCaseIds.length).toBeGreaterThan(0);
      for (const ucId of niche.useCaseIds) {
        expect(QR_USE_CASES[ucId]).toBeDefined();
      }
    }
  });

  it("every niche a use case claims to support actually lists that use case back", () => {
    // Cross-consistency: supportedNiches (on the use case) and useCaseIds
    // (on the niche) describe the same relationship from two directions —
    // they must never drift apart, or the Business QR / Industry Kit flows
    // would show inconsistent options for the same use case.
    for (const uc of Object.values(QR_USE_CASES)) {
      for (const nicheId of uc.supportedNiches) {
        const niche = QR_NICHES[nicheId];
        expect(niche.useCaseIds).toContain(uc.id);
      }
    }
  });

  it("getQrNiche returns the matching entry, undefined for unknown ids", () => {
    expect(getQrNiche("creator")?.label).toBe("Creator");
    expect(getQrNiche("not-a-real-niche")).toBeUndefined();
  });
});
