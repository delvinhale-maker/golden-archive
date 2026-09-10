import { describe, expect, it } from "vitest";
import { creatorStudioProjectInputSchema } from "@/lib/creator-studio.schema";
import { isCreatorStudioEnabled } from "@/lib/creator-studio-feature-flags";

describe("Creator Studio CS1", () => {
  it("accepts the seven supported goals and defaults to a 30s vertical project", () => {
    const parsed = creatorStudioProjectInputSchema.parse({ goal: "PROMOTE_EBOOK" });
    expect(parsed.durationSeconds).toBe(30);
    expect(parsed.styleKey).toBe("LUXURY_EDITORIAL");
    expect(parsed.wizardStep).toBe(1);
  });

  it("rejects unsupported duration", () => {
    expect(() => creatorStudioProjectInputSchema.parse({ goal: "TIKTOK_AD", durationSeconds: 60 })).toThrow();
  });

  it("rejects malformed destination URLs", () => {
    expect(() => creatorStudioProjectInputSchema.parse({ goal: "PRODUCT_TRAILER", destinationUrl: "not-a-url" })).toThrow();
  });

  it("fails closed unless the server flag is exactly true", () => {
    expect(isCreatorStudioEnabled({})).toBe(false);
    expect(isCreatorStudioEnabled({ CREATOR_STUDIO_ENABLED: "false" })).toBe(false);
    expect(isCreatorStudioEnabled({ CREATOR_STUDIO_ENABLED: "TRUE" })).toBe(false);
    expect(isCreatorStudioEnabled({ CREATOR_STUDIO_ENABLED: "true" })).toBe(true);
  });
});
