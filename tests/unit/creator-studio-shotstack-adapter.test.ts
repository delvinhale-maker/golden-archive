import { describe, it, expect } from "bun:test";
import {
  buildShotstackEditRequest,
  mapShotstackStatus,
  normalizeProviderError,
  ShotstackApiError,
} from "@/lib/creator-studio/providers/shotstack.server";
import { planScenes } from "@/lib/creator-studio/scene-planner";

function sampleComposition() {
  return planScenes({
    projectId: "11111111-1111-1111-1111-111111111111",
    projectType: "EBOOK_PROMO",
    stylePreset: "CINEMATIC",
    durationSeconds: 30,
    headline: "My Great eBook",
    ctaText: "Shop Now",
    priceText: "$19.00",
    destinationUrl: "https://www.aurumvault.store/products/my-ebook",
    assets: [
      { id: "cover-1", role: "COVER", storagePath: "u1/cover-1.png", sortOrder: 0 },
      { id: "shot-0", role: "SCREENSHOT", storagePath: "u1/shot-0.png", sortOrder: 0 },
    ],
  });
}

describe("buildShotstackEditRequest -- pure JSON mapping, no network", () => {
  it("produces one Shotstack image clip per scene with a resolved source URL", () => {
    const composition = sampleComposition();
    const urls = Object.fromEntries(
      composition.scenes.map((s, i) => [s.id, `https://signed.example/${i}`]),
    );
    const request = buildShotstackEditRequest(
      composition,
      urls,
      "https://api.example.com/webhook?token=abc",
    );

    const timeline = (request as any).timeline;
    const imageTrack = timeline.tracks[timeline.tracks.length - 1];
    expect(imageTrack.clips.length).toBe(composition.scenes.length);
    expect((request as any).callback).toBe("https://api.example.com/webhook?token=abc");
    expect((request as any).output.size).toEqual({ width: 1080, height: 1920 });
    expect((request as any).output.fps).toBe(30);
  });

  it("adds a title track only when at least one scene carries text", () => {
    const composition = sampleComposition();
    const urls = Object.fromEntries(
      composition.scenes.map((s, i) => [s.id, `https://signed.example/${i}`]),
    );
    const request = buildShotstackEditRequest(composition, urls, "https://api.example.com/webhook");
    const hasHeadline = composition.scenes.some((s) => s.text.headline);
    expect(hasHeadline).toBe(true);
    expect((request as any).timeline.tracks.length).toBe(2);
  });

  it("never includes a provider API key or secret in the built request body", () => {
    const composition = sampleComposition();
    const urls = Object.fromEntries(
      composition.scenes.map((s, i) => [s.id, `https://signed.example/${i}`]),
    );
    const request = buildShotstackEditRequest(composition, urls, "https://api.example.com/webhook");
    const serialized = JSON.stringify(request).toLowerCase();
    expect(serialized).not.toContain("api-key");
    expect(serialized).not.toContain("secret");
  });
});

describe("mapShotstackStatus -- provider status -> canonical internal status", () => {
  it("maps every known Shotstack status to a canonical render_jobs status", () => {
    expect(mapShotstackStatus("queued")).toBe("QUEUED");
    expect(mapShotstackStatus("fetching")).toBe("SUBMITTED");
    expect(mapShotstackStatus("rendering")).toBe("RENDERING");
    expect(mapShotstackStatus("saving")).toBe("RENDERING");
    expect(mapShotstackStatus("done")).toBe("SUCCEEDED");
    expect(mapShotstackStatus("failed")).toBe("FAILED");
  });

  it("defaults an unrecognized status to RENDERING rather than throwing", () => {
    expect(mapShotstackStatus("some-new-status-shotstack-adds-later")).toBe("RENDERING");
  });
});

describe("normalizeProviderError -- never leaks raw provider detail", () => {
  it("maps 401/403 to provider_auth_failed with the exact safe customer message", () => {
    const result = normalizeProviderError(
      new ShotstackApiError(401, '{"secret":"sk_live_abc123"}'),
    );
    expect(result.errorCode).toBe("provider_auth_failed");
    expect(result.safeErrorMessage).toBe(
      "We couldn't finish this video. Your video credit was not consumed.",
    );
    expect(result.safeErrorMessage).not.toContain("sk_live");
  });

  it("maps 400/422 to provider_rejected_composition", () => {
    expect(normalizeProviderError(new ShotstackApiError(422, "bad timeline")).errorCode).toBe(
      "provider_rejected_composition",
    );
  });

  it("maps 5xx to provider_unavailable", () => {
    expect(normalizeProviderError(new ShotstackApiError(503, "")).errorCode).toBe(
      "provider_unavailable",
    );
  });

  it("maps an AbortError to provider_timeout", () => {
    const abort = new Error("timed out");
    abort.name = "AbortError";
    expect(normalizeProviderError(abort).errorCode).toBe("provider_timeout");
  });

  it("never returns the raw error object/string as the safe message", () => {
    const result = normalizeProviderError("some raw provider JSON with secrets");
    expect(result.safeErrorMessage).not.toContain("raw provider JSON");
  });
});
