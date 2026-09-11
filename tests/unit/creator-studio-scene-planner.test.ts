import { describe, it, expect } from "bun:test";
import {
  planScenes,
  SceneValidationError,
  type PlannerAsset,
  type PlanScenesInput,
} from "@/lib/creator-studio/scene-planner";
import { TEMPLATE_VERSION } from "@/lib/creator-studio/templates";

const COVER: PlannerAsset = {
  id: "cover-1",
  role: "COVER",
  storagePath: "u1/cover-1.png",
  sortOrder: 0,
};
const LOGO: PlannerAsset = {
  id: "logo-1",
  role: "LOGO",
  storagePath: "u1/logo-1.png",
  sortOrder: 0,
};
function screenshots(n: number): PlannerAsset[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `shot-${i}`,
    role: "SCREENSHOT" as const,
    storagePath: `u1/shot-${i}.png`,
    sortOrder: i,
  }));
}

function baseInput(overrides: Partial<PlanScenesInput> = {}): PlanScenesInput {
  return {
    projectId: "11111111-1111-1111-1111-111111111111",
    projectType: "EBOOK_PROMO",
    stylePreset: "CLEAN_MINIMAL",
    durationSeconds: 30,
    headline: "My Great eBook",
    ctaText: "Shop Now",
    priceText: "$19.00",
    destinationUrl: "https://www.aurumvault.store/products/my-ebook",
    assets: [COVER, LOGO, ...screenshots(2)],
    ...overrides,
  };
}

describe("planScenes -- minimum asset set", () => {
  it("succeeds with just a cover (no logo, no screenshots)", () => {
    const composition = planScenes(baseInput({ assets: [COVER] }));
    expect(composition.scenes.length).toBeGreaterThan(0);
  });

  it("throws creator_studio_missing_cover when no cover is attached", () => {
    expect(() => planScenes(baseInput({ assets: [LOGO, ...screenshots(2)] }))).toThrow(
      SceneValidationError,
    );
    try {
      planScenes(baseInput({ assets: [] }));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SceneValidationError);
      expect((e as SceneValidationError).code).toBe("creator_studio_missing_cover");
    }
  });
});

describe("planScenes -- excessive screenshots", () => {
  it("caps STANDARD_PROMO's FEATURE scenes at 3 even with 10 screenshots supplied", () => {
    const composition = planScenes(baseInput({ assets: [COVER, ...screenshots(10)] }));
    const featureScenes = composition.scenes.filter((s) => s.type === "FEATURE");
    expect(featureScenes.length).toBe(3);
  });

  it("uses exactly as many FEATURE scenes as screenshots when under the cap", () => {
    const composition = planScenes(baseInput({ assets: [COVER, ...screenshots(1)] }));
    expect(composition.scenes.filter((s) => s.type === "FEATURE").length).toBe(1);
  });

  it("drops the FEATURE entry entirely (renormalizing) when zero screenshots are supplied", () => {
    const composition = planScenes(baseInput({ assets: [COVER] }));
    expect(composition.scenes.some((s) => s.type === "FEATURE")).toBe(false);
    const total = composition.scenes.reduce((sum, s) => sum + s.duration, 0);
    expect(Math.round(total * 100) / 100).toBe(30);
  });
});

describe("planScenes -- duration handling", () => {
  for (const duration of [15, 30, 45] as const) {
    it(`tiles scenes to exactly ${duration}s with no gap or overlap`, () => {
      const composition = planScenes(baseInput({ durationSeconds: duration }));
      expect(composition.duration).toBe(duration);
      let cursor = 0;
      for (const scene of composition.scenes) {
        expect(Math.abs(scene.start - cursor)).toBeLessThan(0.01);
        cursor += scene.duration;
      }
      expect(Math.abs(cursor - duration)).toBeLessThan(0.01);
    });
  }

  it("rejects a duration outside {15,30,45} even if it slips past the type system", () => {
    expect(() => planScenes(baseInput({ durationSeconds: 20 as 15 }))).toThrow(
      SceneValidationError,
    );
  });
});

describe("planScenes -- determinism", () => {
  it("produces byte-identical output for the same input called twice", () => {
    const input = baseInput();
    const a = planScenes(input);
    const b = planScenes(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("planScenes -- template version preservation", () => {
  it("stamps the current TEMPLATE_VERSION and the project-type-appropriate template key", () => {
    const ebook = planScenes(baseInput({ projectType: "EBOOK_PROMO" }));
    expect(ebook.metadata.templateVersion).toBe(TEMPLATE_VERSION);
    expect(ebook.metadata.templateKey).toBe("standard_promo");

    const tiktok = planScenes(baseInput({ projectType: "TIKTOK_AD" }));
    expect(tiktok.metadata.templateKey).toBe("social_ad");

    const trailer = planScenes(baseInput({ projectType: "BOOK_TRAILER" }));
    expect(trailer.metadata.templateKey).toBe("book_trailer");
  });
});

describe("planScenes -- CTA length limits", () => {
  it("truncates a CTA longer than 60 characters and keeps branding.ctaText within the limit", () => {
    const longCta = "A".repeat(120);
    const composition = planScenes(baseInput({ ctaText: longCta }));
    expect(composition.branding.ctaText.length).toBeLessThanOrEqual(60);
    expect(composition.branding.ctaText.endsWith("…")).toBe(true);
  });
});

describe("planScenes -- text overflow safety", () => {
  it("truncates an overlong headline in the HOOK scene to its safe-zone character budget", () => {
    const longHeadline =
      "This headline is deliberately far too long for a nine second hook scene to hold safely";
    const composition = planScenes(baseInput({ headline: longHeadline }));
    const hook = composition.scenes.find((s) => s.type === "HOOK");
    expect(hook).toBeDefined();
    expect((hook!.text.headline ?? "").length).toBeLessThanOrEqual(60);
  });

  it("never attaches text to scene types with a zero character budget (COVER_REVEAL, FEATURE)", () => {
    const composition = planScenes(baseInput());
    for (const scene of composition.scenes) {
      if (scene.type === "COVER_REVEAL" || scene.type === "FEATURE") {
        expect(scene.text.headline).toBeUndefined();
      }
    }
  });
});

describe("planScenes -- logo fallback", () => {
  it("falls back the CTA scene's image to the cover when no logo asset is attached", () => {
    const composition = planScenes(baseInput({ assets: [COVER, ...screenshots(2)] }));
    const cta = composition.scenes.find((s) => s.type === "CTA");
    expect(cta?.assetRef?.assetId).toBe(COVER.id);
    expect(cta?.assetRef?.role).toBe("COVER");
  });
});
