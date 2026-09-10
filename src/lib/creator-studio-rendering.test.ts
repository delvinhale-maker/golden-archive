import { describe, expect, it } from "vitest";
import { creatorStudioRenderInternals } from "@/lib/creator-studio-render-service.server";
import { isCreatorStudioRenderingEnabled } from "@/lib/creator-studio-rendering.middleware";
import { buildShotstackEdit } from "@/lib/creator-studio-shotstack.server";
import { planCreatorStudioScenes } from "@/lib/creator-studio-scene-planner";

describe("Creator Studio rendering safety", () => {
  it("fails closed unless rendering is exactly enabled", () => {
    expect(isCreatorStudioRenderingEnabled({})).toBe(false);
    expect(isCreatorStudioRenderingEnabled({ CREATOR_STUDIO_RENDERING_ENABLED: "false" })).toBe(false);
    expect(isCreatorStudioRenderingEnabled({ CREATOR_STUDIO_RENDERING_ENABLED: "true" })).toBe(true);
  });

  it("maps provider statuses without exposing provider payloads", () => {
    expect(creatorStudioRenderInternals.mapStatus("queued")).toBe("QUEUED");
    expect(creatorStudioRenderInternals.mapStatus("rendering")).toBe("RENDERING");
    expect(creatorStudioRenderInternals.mapStatus("done")).toBe("COMPLETED");
    expect(creatorStudioRenderInternals.mapStatus("failed")).toBe("FAILED");
  });

  it("sanitizes provider errors", () => {
    expect(creatorStudioRenderInternals.safeFailureCode(new Error("SHOTSTACK_HTTP_429"))).toBe("SHOTSTACK_HTTP_429");
    expect(creatorStudioRenderInternals.safeFailureCode(new Error("secret internal message"))).toBe("RENDER_PROVIDER_FAILURE");
  });

  it("estimates cost proportionally", () => {
    const old = process.env.CREATOR_STUDIO_ESTIMATED_RENDER_COST_CENTS_PER_MINUTE;
    process.env.CREATOR_STUDIO_ESTIMATED_RENDER_COST_CENTS_PER_MINUTE = "30";
    expect(creatorStudioRenderInternals.estimateCostCents(30)).toBe(15);
    expect(creatorStudioRenderInternals.estimateCostCents(45)).toBe(23);
    if (old === undefined) delete process.env.CREATOR_STUDIO_ESTIMATED_RENDER_COST_CENTS_PER_MINUTE; else process.env.CREATOR_STUDIO_ESTIMATED_RENDER_COST_CENTS_PER_MINUTE = old;
  });

  it("translates the provider-neutral plan to a vertical Shotstack edit", () => {
    const plan = planCreatorStudioScenes({ goal: "PRODUCT_TRAILER", style: "CINEMATIC", durationSeconds: 30, productTitle: "Product", callToAction: "Buy now" });
    const edit = buildShotstackEdit(plan, { cover: "https://example.com/cover.png", screenshots: ["https://example.com/one.png"], logo: "https://example.com/logo.png" });
    expect(edit.output.format).toBe("mp4");
    expect(edit.output.size).toEqual({ width: 1080, height: 1920 });
    expect(edit.timeline.tracks[0].clips).toHaveLength(plan.scenes.length);
  });
});
