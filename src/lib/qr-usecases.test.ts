import { describe, it, expect } from "vitest";
import {
  NICHE_KITS,
  QR_NICHES,
  QR_USE_CASES,
  USE_CASE_META,
  destinationTypeForUseCase,
  isQrNiche,
  isQrUseCase,
  normalizePlacementLabel,
  suggestedPlacements,
} from "./qr-usecases";

describe("use-case configuration integrity", () => {
  it("every use case has outcome-first copy and a usable destination type", () => {
    for (const uc of QR_USE_CASES) {
      const meta = USE_CASE_META[uc];
      expect(meta.label.length).toBeGreaterThan(3);
      expect(meta.outcome.length).toBeGreaterThan(10);
      expect(meta.suggestedName.length).toBeGreaterThan(0);
      expect(meta.placements.length).toBeGreaterThan(0);
      // "text" is static-only — no goal may map to it, since every goal here
      // can be saved as a dynamic (editable, trackable) QR code.
      expect(meta.destinationType).not.toBe("text");
    }
  });

  it("no goal label leaks technical jargon at the business owner", () => {
    const banned = ["url", "http", "mailto", "sms:", "tel:", "payload", "redirect"];
    for (const uc of QR_USE_CASES) {
      const label = USE_CASE_META[uc].label.toLowerCase();
      for (const word of banned) expect(label).not.toContain(word);
    }
  });

  it("every niche kit lists real, non-empty, unique goals", () => {
    for (const niche of QR_NICHES) {
      const kit = NICHE_KITS[niche];
      expect(kit.useCases.length).toBeGreaterThanOrEqual(3);
      expect(new Set(kit.useCases).size).toBe(kit.useCases.length);
      for (const uc of kit.useCases) expect(isQrUseCase(uc)).toBe(true);
      expect(kit.placements.length).toBeGreaterThan(0);
    }
  });

  it("the three named industry kits all exist alongside a general kit", () => {
    for (const n of ["general", "real_estate", "creator", "beauty"]) {
      expect(isQrNiche(n)).toBe(true);
    }
  });

  it("storefront and product goals are the only shortcut-backed goals", () => {
    const shortcuts = QR_USE_CASES.filter((uc) => USE_CASE_META[uc].shortcut);
    expect(shortcuts.sort()).toEqual(["product", "storefront"]);
    expect(USE_CASE_META.storefront.shortcut).toBe("storefront");
    expect(USE_CASE_META.product.shortcut).toBe("product");
  });
});

describe("destinationTypeForUseCase", () => {
  it("maps contact goals to their device actions", () => {
    expect(destinationTypeForUseCase("call")).toBe("tel");
    expect(destinationTypeForUseCase("text")).toBe("sms");
    expect(destinationTypeForUseCase("contact")).toBe("email");
    expect(destinationTypeForUseCase("storefront")).toBe("url");
  });
});

describe("suggestedPlacements", () => {
  it("puts the industry's own ideas first", () => {
    const list = suggestedPlacements("booking", "real_estate");
    expect(list[0]).toBe("Yard sign");
    expect(list).toContain("Open house flyer");
  });

  it("de-duplicates across the kit and the goal, case-insensitively", () => {
    for (const niche of QR_NICHES) {
      for (const uc of QR_USE_CASES) {
        const list = suggestedPlacements(uc, niche);
        const lower = list.map((p) => p.toLowerCase());
        expect(new Set(lower).size).toBe(list.length);
      }
    }
  });

  it("includes the goal's generic placements too", () => {
    expect(suggestedPlacements("reviews", "beauty")).toContain("Receipt");
  });
});

describe("normalizePlacementLabel", () => {
  it("trims, and treats blank input as no placement", () => {
    expect(normalizePlacementLabel("  Front window  ")).toBe("Front window");
    expect(normalizePlacementLabel("   ")).toBeNull();
    expect(normalizePlacementLabel(null)).toBeNull();
    expect(normalizePlacementLabel(undefined)).toBeNull();
  });

  it("strips control characters", () => {
    expect(normalizePlacementLabel("Front\u0000 window\u001f")).toBe("Front window");
  });

  it("caps length at the database constraint's 80 characters", () => {
    expect(normalizePlacementLabel("x".repeat(200))).toHaveLength(80);
  });
});
