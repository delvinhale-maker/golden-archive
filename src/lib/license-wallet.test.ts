import { describe, expect, it } from "vitest";
import {
  checkDocumentQuota,
  checkLocationQuota,
  computeWalletStatus,
  daysUntil,
  dueReminderOffset,
  formatPlanPrice,
  WALLET_PLANS,
  WALLET_PLAN_PRICE_IDS,
  walletBillingConfigured,
  walletPlanCheckoutEnabled,
  isLicenseWalletCategory,
  isReminderMilestoneEnabled,
  normalizeReminderOffsets,
  reminderOffsetLabel,
  reminderSubject,
  summarizeStatuses,
  walletFileError,
  WALLET_MAX_BYTES,
} from "@/lib/license-wallet";

const TODAY = "2026-03-01";

describe("license wallet status derivation", () => {
  it("treats no-expiration documents as NO_EXPIRATION", () => {
    expect(computeWalletStatus({ no_expiration: true, expiration_date: null }, TODAY)).toBe("NO_EXPIRATION");
    expect(computeWalletStatus({ expiration_date: null }, TODAY)).toBe("NO_EXPIRATION");
  });

  it("flags expired, expiring-soon and current documents", () => {
    expect(computeWalletStatus({ expiration_date: "2026-02-28" }, TODAY)).toBe("EXPIRED");
    expect(computeWalletStatus({ expiration_date: "2026-03-01" }, TODAY)).toBe("EXPIRING_SOON");
    expect(computeWalletStatus({ expiration_date: "2026-03-31" }, TODAY)).toBe("EXPIRING_SOON");
    expect(computeWalletStatus({ expiration_date: "2026-04-01" }, TODAY)).toBe("CURRENT");
  });

  it("computes UTC-normalised day gaps", () => {
    expect(daysUntil("2026-03-31", TODAY)).toBe(30);
    expect(daysUntil("2026-02-01", TODAY)).toBe(-28);
  });

  it("summarizes counts per status", () => {
    const counts = summarizeStatuses(
      [
        { expiration_date: "2026-02-01" },
        { expiration_date: "2026-03-10" },
        { expiration_date: "2027-01-01" },
        { no_expiration: true },
      ],
      TODAY,
    );
    expect(counts).toEqual({ EXPIRED: 1, EXPIRING_SOON: 1, CURRENT: 1, NO_EXPIRATION: 1 });
  });
});

describe("reminder scheduling", () => {
  it("returns an offset only on exact lead-time days", () => {
    expect(dueReminderOffset({ expiration_date: "2026-04-30" }, TODAY)).toBe(60);
    expect(dueReminderOffset({ expiration_date: "2026-03-31" }, TODAY)).toBe(30);
    expect(dueReminderOffset({ expiration_date: "2026-03-01" }, TODAY)).toBe(0);
    expect(dueReminderOffset({ expiration_date: "2026-03-05" }, TODAY)).toBeNull();
  });

  it("never reminds for past or non-expiring documents", () => {
    expect(dueReminderOffset({ expiration_date: "2026-02-01" }, TODAY)).toBeNull();
    expect(dueReminderOffset({ no_expiration: true, expiration_date: "2026-03-02" }, TODAY)).toBeNull();
  });

  it("labels the subject line", () => {
    expect(reminderSubject("General Liability COI", 0)).toBe("Expires today: General Liability COI");
    expect(reminderSubject("City Permit", 1)).toBe("Expires in 1 day: City Permit");
    expect(reminderSubject("City Permit", 7)).toBe("Expires in 7 days: City Permit");
  });
});

describe("reminder milestone preferences", () => {
  it("defaults to 30/21/7/1 when nothing is stored", () => {
    expect(normalizeReminderOffsets(undefined)).toEqual([30, 21, 7, 1]);
    expect(isReminderMilestoneEnabled(null, 30)).toBe(true);
    expect(isReminderMilestoneEnabled(null, 60)).toBe(false);
    expect(isReminderMilestoneEnabled(null, 0)).toBe(false);
  });

  it("sanitises stored selections and keeps longest lead time first", () => {
    expect(normalizeReminderOffsets([1, 60, 60, 5, "14"])).toEqual([60, 14, 1]);
  });

  it("honours an explicit empty selection", () => {
    expect(normalizeReminderOffsets([])).toEqual([]);
    expect(isReminderMilestoneEnabled([], 7)).toBe(false);
  });

  it("labels milestones for the settings UI", () => {
    expect(reminderOffsetLabel(0)).toBe("Expiration day");
    expect(reminderOffsetLabel(1)).toBe("1 day before");
    expect(reminderOffsetLabel(21)).toBe("21 days before");
  });
});

describe("uploads", () => {
  it("accepts PDF and images within the size limit", () => {
    expect(walletFileError("coi.pdf", "application/pdf", 1000)).toBeNull();
    expect(walletFileError("license.PNG", "image/png", 1000)).toBeNull();
  });

  it("rejects unsupported types, empty and oversize files", () => {
    expect(walletFileError("notes.docx", "application/msword", 1000)).toMatch(/PDF, JPG/);
    expect(walletFileError("coi.pdf", "application/pdf", 0)).toMatch(/empty/);
    expect(walletFileError("coi.pdf", "application/pdf", WALLET_MAX_BYTES + 1)).toMatch(/10 MB/);
  });
});

describe("plans and quotas", () => {
  it("prices the published tiers", () => {
    expect(formatPlanPrice("SOLO")).toBe("$12/month");
    expect(formatPlanPrice("BUSINESS")).toBe("$29/month");
    expect(formatPlanPrice("MULTI_LOCATION")).toBe("$69/month");
    expect(formatPlanPrice("FREE")).toBe("Included");
  });

  it("blocks over-quota documents and locations", () => {
    expect(checkDocumentQuota("FREE", 2).allowed).toBe(true);
    expect(checkDocumentQuota("FREE", 3).allowed).toBe(false);
    expect(checkLocationQuota("SOLO", 1).allowed).toBe(false);
    expect(checkLocationQuota("MULTI_LOCATION", 10).allowed).toBe(true);
  });

  it("gives Business 5 locations and enforces it from the same source as the UI", () => {
    expect(WALLET_PLANS.BUSINESS.maxLocations).toBe(5);
    expect(checkLocationQuota("BUSINESS", 4).allowed).toBe(true);
    expect(checkLocationQuota("BUSINESS", 5).allowed).toBe(false);
    expect(WALLET_PLANS.SOLO.maxLocations).toBe(1);
  });

  it("exposes paid-plan checkout only for configured recurring prices", () => {
    expect(walletBillingConfigured()).toBe(true);
    expect(walletPlanCheckoutEnabled("BUSINESS")).toBe(true);
    expect(walletPlanCheckoutEnabled("FREE")).toBe(false);
    expect(
      Object.values(WALLET_PLAN_PRICE_IDS).every(
        (v) => typeof v === "string" && v.startsWith("license_wallet_"),
      ),
    ).toBe(true);
  });

  it("validates categories", () => {
    expect(isLicenseWalletCategory("PERMIT")).toBe(true);
    expect(isLicenseWalletCategory("SOMETHING_ELSE")).toBe(false);
  });
});