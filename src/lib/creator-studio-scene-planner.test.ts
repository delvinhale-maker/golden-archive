import { describe, expect, it } from "vitest";
import { planCreatorStudioScenes } from "@/lib/creator-studio-scene-planner";

describe("Creator Studio scene planner", () => {
  it.each([15, 30, 45] as const)("plans an exact %ss vertical video", (durationSeconds) => {
    const plan = planCreatorStudioScenes({ goal: "PROMOTE_EBOOK", style: "LUXURY_EDITORIAL", durationSeconds, productTitle: "My Book", callToAction: "Get the book" });
    expect(plan.output.durationSeconds).toBe(durationSeconds);
    expect(plan.output.aspectRatio).toBe("9:16");
    expect(plan.output.width).toBe(1080);
    expect(plan.output.height).toBe(1920);
    expect(plan.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0)).toBe(durationSeconds);
    expect(plan.scenes[0].kind).toBe("HOOK");
    expect(plan.scenes.at(-1)?.kind).toBe("CTA");
  });

  it("falls back to Luxury Editorial when Book Trailer style does not support the goal", () => {
    const plan = planCreatorStudioScenes({ goal: "PROMOTE_COURSE", style: "BOOK_TRAILER", durationSeconds: 30 });
    expect(plan.templateId).toBe("av-luxury-editorial");
    expect(plan.style).toBe("LUXURY_EDITORIAL");
  });
});
