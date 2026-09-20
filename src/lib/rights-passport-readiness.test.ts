import { describe, it, expect } from "vitest";
import { computeReadinessScore } from "./rights-passport-readiness";

const emptyPassport = {
  public_professional_name: null,
  rights_contact_email: null,
  verification_level: "SELF_DECLARED" as const,
  successor_estate_contact: null,
  public_rights_url: null,
};

const fullPassport = {
  public_professional_name: "Jordan Rivers",
  rights_contact_email: "rights@example.com",
  verification_level: "DOCUMENT_SUPPORTED" as const,
  successor_estate_contact: "estate@example.com",
  public_rights_url: "https://example.com/rights",
};

describe("computeReadinessScore", () => {
  it("scores an empty passport with no assets as 0", () => {
    const r = computeReadinessScore(emptyPassport, []);
    expect(r.score).toBe(0);
    expect(r.gaps.length).toBeGreaterThan(0);
    expect(r.primaryGap).not.toBeNull();
  });

  it("scores a fully-filled passport with a clean asset as 100", () => {
    const r = computeReadinessScore(fullPassport, [
      { control_basis: "CREATORSHIP", status: "ACTIVE" },
    ]);
    expect(r.score).toBe(100);
    expect(r.gaps.length).toBe(0);
    expect(r.primaryGap).toBeNull();
    expect(r.openReviewCount).toBe(0);
  });

  it("never exceeds 100 or drops below 0", () => {
    const r1 = computeReadinessScore(fullPassport, [
      { control_basis: "CREATORSHIP", status: "ACTIVE" },
    ]);
    expect(r1.score).toBeLessThanOrEqual(100);
    const r2 = computeReadinessScore(emptyPassport, []);
    expect(r2.score).toBeGreaterThanOrEqual(0);
  });

  it("penalizes open REVIEW_REQUIRED items even on an otherwise-complete passport", () => {
    const clean = computeReadinessScore(fullPassport, [
      { control_basis: "CREATORSHIP", status: "ACTIVE" },
    ]);
    const withReview = computeReadinessScore(fullPassport, [
      { control_basis: "CREATORSHIP", status: "ACTIVE" },
      { control_basis: "REVIEW_REQUIRED", status: "ACTIVE" },
    ]);
    expect(withReview.score).toBeLessThan(clean.score);
    expect(withReview.openReviewCount).toBe(1);
  });

  it("counts an asset with status REVIEW_REQUIRED even if control_basis is resolved", () => {
    const r = computeReadinessScore(fullPassport, [
      { control_basis: "CREATORSHIP", status: "REVIEW_REQUIRED" },
    ]);
    expect(r.openReviewCount).toBe(1);
  });

  it("never asserts ownership — only measures completeness (no field named 'verified' or 'owns')", () => {
    const r = computeReadinessScore(fullPassport, []);
    const serialized = JSON.stringify(r);
    expect(serialized).not.toMatch(/"owns"|"verified":true|legallyOwns/i);
  });

  it("primaryGap is the highest-weight open gap", () => {
    const r = computeReadinessScore(emptyPassport, []);
    const maxWeight = Math.max(...r.gaps.map((g) => g.weight));
    expect(r.primaryGap?.weight).toBe(maxWeight);
  });

  it("having zero assets is itself a gap, distinct from review-required assets", () => {
    const r = computeReadinessScore(fullPassport, []);
    expect(r.gaps.some((g) => g.id === "no_assets")).toBe(true);
  });
});
