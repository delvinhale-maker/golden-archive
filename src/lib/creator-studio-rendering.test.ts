import { describe, expect, it } from "vitest";
import { buildShotstackEdit, estimateCreatorStudioRenderCost, mapShotstackStatus } from "./creator-studio-rendering.server";

const assetId = "11111111-1111-4111-8111-111111111111";
const plan = {
  schemaVersion: 1 as const,
  templateKey: "promote_ebook__cinematic__v1",
  templateRevision: 1,
  durationSeconds: 15 as const,
  aspectRatio: "9:16" as const,
  scenes: [
    { key: "hook", startSeconds: 0, durationSeconds: 3, role: "HOOK" as const, headline: "A better launch" },
    { key: "cover", startSeconds: 3, durationSeconds: 9, role: "COVER" as const, assetId },
    { key: "cta", startSeconds: 12, durationSeconds: 3, role: "CTA" as const, headline: "Get it now" },
  ],
};

describe("Creator Studio rendering primitives", () => {
  it("maps authoritative Shotstack terminal states", () => {
    expect(mapShotstackStatus("done")).toBe("COMPLETED");
    expect(mapShotstackStatus("failed")).toBe("FAILED");
    expect(mapShotstackStatus("rendering")).toBe("RENDERING");
  });

  it("builds a 9:16 mp4 edit using signed asset urls", () => {
    const edit = buildShotstackEdit(plan, { [assetId]: "https://example.com/signed-cover.jpg" }) as any;
    expect(edit.output.format).toBe("mp4");
    expect(edit.output.aspectRatio).toBe("9:16");
    expect(edit.timeline.tracks[0].clips).toHaveLength(3);
    expect(edit.timeline.tracks[0].clips[1].asset.src).toContain("signed-cover.jpg");
  });

  it("never returns a negative estimated cost", () => {
    expect(estimateCreatorStudioRenderCost(15)).toBeGreaterThanOrEqual(0);
  });
});
