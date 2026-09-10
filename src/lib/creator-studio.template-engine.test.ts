import { describe, expect, it } from "vitest";
import { creatorStudioRenderPlanSchema } from "@/lib/creator-studio.render-plan";
import { buildCreatorStudioRenderPlan } from "@/lib/creator-studio.template-engine";
import type { CreatorStudioProjectType } from "@/lib/creator-studio.schema";

const PROJECT_TYPES: CreatorStudioProjectType[] = [
  "PROMOTE_EBOOK",
  "PROMOTE_COURSE",
  "PROMOTE_PLANNER",
  "TIKTOK_AD",
  "INSTAGRAM_REEL",
  "PRODUCT_TRAILER",
  "BOOK_TRAILER",
];

function input(
  projectType: CreatorStudioProjectType = "PROMOTE_EBOOK",
  durationSeconds: 15 | 30 | 45 = 30,
) {
  return {
    project: {
      id: "11111111-1111-4111-8111-111111111111",
      project_type: projectType,
      status: "READY" as const,
      duration_seconds: durationSeconds,
      aspect_ratio: "9:16" as const,
      style_key: "LUXURY_EDITORIAL" as const,
      product_title: "The Creator Playbook",
      hook: "Turn one idea into something people want to buy.",
      cta: "Get your copy today",
      destination_url: "/products/the-creator-playbook",
      price_cents: 1499,
      currency: "USD",
    },
    assets: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        category: "PRODUCT_COVER" as const,
        state: "READY" as const,
        mime_type: "image/png" as const,
        sort_order: 0,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        category: "SCREENSHOT" as const,
        state: "READY" as const,
        mime_type: "image/png" as const,
        sort_order: 1,
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        category: "ADDITIONAL_MEDIA" as const,
        state: "READY" as const,
        mime_type: "video/mp4" as const,
        sort_order: 2,
      },
    ],
    source_product_media: { has_cover: false, preview_count: 2 },
    quality: "STANDARD" as const,
  };
}

describe("Creator Studio CS2 deterministic template engine", () => {
  it("generates a validated render plan for every V1 template family", () => {
    for (const projectType of PROJECT_TYPES) {
      const plan = buildCreatorStudioRenderPlan(input(projectType));
      expect(creatorStudioRenderPlanSchema.safeParse(plan).success).toBe(true);
      expect(plan.scenes.map((scene) => scene.purpose)).toEqual([
        "HOOK",
        "COVER_REVEAL",
        "PRODUCT_PROOF",
        "BENEFIT",
        "HERO",
        "CTA",
      ]);
    }
  });

  it("fills exactly 15, 30 and 45 seconds without gaps or overlap", () => {
    for (const duration of [15, 30, 45] as const) {
      const plan = buildCreatorStudioRenderPlan(input("PRODUCT_TRAILER", duration));
      expect(plan.output.duration_ms).toBe(duration * 1000);
      expect(plan.scenes.reduce((sum, scene) => sum + scene.duration_ms, 0)).toBe(
        duration * 1000,
      );
      for (let index = 1; index < plan.scenes.length; index += 1) {
        const previous = plan.scenes[index - 1];
        const current = plan.scenes[index];
        expect(current.start_ms).toBe(previous.start_ms + previous.duration_ms);
      }
    }
  });

  it("is deterministic for identical project and asset input", () => {
    expect(buildCreatorStudioRenderPlan(input())).toEqual(buildCreatorStudioRenderPlan(input()));
  });

  it("uses only logical media references in the provider-independent plan", () => {
    const serialized = JSON.stringify(buildCreatorStudioRenderPlan(input()));
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("shotstack");
    expect(serialized).toContain("asset:22222222-2222-4222-8222-222222222222");
    expect(serialized).toContain("source:preview:0");
  });

  it("can use a trusted source-product cover without embedding its URL", () => {
    const raw = input();
    raw.assets = raw.assets.filter((asset) => asset.category !== "PRODUCT_COVER");
    raw.source_product_media.has_cover = true;
    const plan = buildCreatorStudioRenderPlan(raw);
    expect(JSON.stringify(plan)).toContain("source:cover");
  });

  it("rejects a project that has no usable cover", () => {
    const raw = input();
    raw.assets = raw.assets.filter((asset) => asset.category !== "PRODUCT_COVER");
    raw.source_product_media = { has_cover: false, preview_count: 0 };
    expect(() => buildCreatorStudioRenderPlan(raw)).toThrow(/requires a ready product cover/i);
  });

  it("rejects projects that are not READY", () => {
    const raw = input() as ReturnType<typeof input> & { project: { status: string } };
    raw.project.status = "DRAFT";
    expect(() => buildCreatorStudioRenderPlan(raw)).toThrow();
  });

  it("rejects invalid assets before scene generation", () => {
    const raw = input();
    raw.assets[0] = { ...raw.assets[0], mime_type: "application/pdf" as "image/png" };
    expect(() => buildCreatorStudioRenderPlan(raw)).toThrow();
  });

  it("adds a deterministic AurumVault watermark to preview plans", () => {
    const raw = input();
    raw.quality = "PREVIEW";
    const plan = buildCreatorStudioRenderPlan(raw);
    expect(plan.output.quality).toBe("PREVIEW");
    expect(
      plan.scenes.every((scene) =>
        scene.layers.some(
          (layer) => layer.type === "TEXT" && layer.role === "WATERMARK",
        ),
      ),
    ).toBe(true);
  });
});
