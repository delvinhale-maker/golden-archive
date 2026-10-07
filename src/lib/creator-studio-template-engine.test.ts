import { describe, expect, it } from "vitest";
import { planCreatorStudioVideo } from "./creator-studio-template-engine";

const cover = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "COVER" as const,
  signedUrl: "https://example.com/cover.jpg",
  mimeType: "image/jpeg",
};

const shot = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "SCREENSHOT" as const,
  signedUrl: "https://example.com/shot.jpg",
  mimeType: "image/jpeg",
};

describe("planCreatorStudioVideo", () => {
  it("builds a deterministic 30 second 9:16 plan", () => {
    const plan = planCreatorStudioVideo({
      goal: "PROMOTE_EBOOK",
      style: "LUXURY_EDITORIAL",
      durationSeconds: 30,
      productTitle: "The System",
      callToAction: "Get the book",
      assets: [cover, shot],
    });
    expect(plan.aspectRatio).toBe("9:16");
    expect(plan.durationSeconds).toBe(30);
    expect(plan.scenes[0].role).toBe("HOOK");
    expect(plan.scenes.at(-1)?.role).toBe("CTA");
    const end = Math.max(...plan.scenes.map((scene) => scene.startSeconds + scene.durationSeconds));
    expect(end).toBe(30);
  });

  it("rejects unsupported durations", () => {
    expect(() =>
      planCreatorStudioVideo({
        goal: "TIKTOK_AD",
        style: "BOLD_SOCIAL",
        durationSeconds: 60,
        productTitle: "Test",
        callToAction: "Buy now",
        assets: [cover],
      }),
    ).toThrow();
  });
});
