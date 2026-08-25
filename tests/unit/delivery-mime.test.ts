import { describe, it, expect } from "vitest";
import { isAllowedDeliveryFile, isAllowedDeliveryMime } from "@/lib/product-delivery";

describe("delivery file validation", () => {
  it("accepts a real ZIP bundle", () => {
    const name = "Film_Distribution_Readiness_OS_FINAL_SALE_BUNDLE.zip";
    expect(isAllowedDeliveryFile(name)).toBe(true);
    expect(isAllowedDeliveryMime(name, "application/zip")).toBe(true);
    expect(isAllowedDeliveryMime(name, "application/x-zip-compressed")).toBe(true);
  });

  it("tolerates mobile browsers reporting no/neutral MIME type", () => {
    expect(isAllowedDeliveryMime("bundle.zip", "")).toBe(true);
    expect(isAllowedDeliveryMime("bundle.zip", "application/octet-stream")).toBe(true);
  });

  it("rejects a mismatched MIME type", () => {
    expect(isAllowedDeliveryMime("bundle.zip", "text/html")).toBe(false);
    expect(isAllowedDeliveryMime("engine.xlsx", "application/pdf")).toBe(false);
  });

  it("rejects unsupported formats outright", () => {
    expect(isAllowedDeliveryFile("payload.exe")).toBe(false);
    expect(isAllowedDeliveryMime("payload.exe", "application/zip")).toBe(false);
  });

  it("accepts the supporting PDF and XLSX for the example product", () => {
    expect(isAllowedDeliveryMime("Film_OS_INTERACTIVE.pdf", "application/pdf")).toBe(true);
    expect(
      isAllowedDeliveryMime(
        "Film_Distribution_Readiness_Decision_Engine.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(true);
  });
});
