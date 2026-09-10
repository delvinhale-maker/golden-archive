import { describe, expect, it } from "vitest";
import {
  MAX_CREATOR_STUDIO_ASSET_BYTES,
  creatorStudioProjectUpdateSchema,
  creatorStudioUploadRequestSchema,
} from "@/lib/creator-studio.schema";

describe("Creator Studio CS1 schemas", () => {
  it("accepts only the supported V1 durations", () => {
    expect(
      creatorStudioProjectUpdateSchema.safeParse({
        id: crypto.randomUUID(),
        durationSeconds: 15,
      }).success,
    ).toBe(true);
    expect(
      creatorStudioProjectUpdateSchema.safeParse({
        id: crypto.randomUUID(),
        durationSeconds: 60,
      }).success,
    ).toBe(false);
  });

  it("accepts absolute https URLs and AurumVault-relative product paths", () => {
    for (const destinationUrl of [
      "https://example.com/product",
      "/products/my-product",
      "",
    ]) {
      expect(
        creatorStudioProjectUpdateSchema.safeParse({
          id: crypto.randomUUID(),
          destinationUrl,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects javascript destinations", () => {
    expect(
      creatorStudioProjectUpdateSchema.safeParse({
        id: crypto.randomUUID(),
        destinationUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("caps each requested upload at 50 MB", () => {
    const base = {
      projectId: crypto.randomUUID(),
      category: "SCREENSHOT" as const,
      filename: "screen.png",
      mimeType: "image/png",
    };
    expect(
      creatorStudioUploadRequestSchema.safeParse({
        ...base,
        byteSize: MAX_CREATOR_STUDIO_ASSET_BYTES,
      }).success,
    ).toBe(true);
    expect(
      creatorStudioUploadRequestSchema.safeParse({
        ...base,
        byteSize: MAX_CREATOR_STUDIO_ASSET_BYTES + 1,
      }).success,
    ).toBe(false);
  });
});
