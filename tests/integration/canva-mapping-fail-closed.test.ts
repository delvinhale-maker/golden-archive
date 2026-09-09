import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/canva-designs.functions.ts", "utf8");

describe("Canva mapping lookup fail-closed contract", () => {
  test("stops before Canva export when the source-mapping lookup fails", () => {
    const lookupError = source.indexOf("existingMappingError");
    const mappingFailure = source.indexOf('reason: "mapping_failed"', lookupError);
    const tokenRead = source.indexOf("getValidCanvaAccessToken(context.userId)", lookupError);
    const exportCall = source.indexOf("exportCanvaDesign(token", lookupError);

    expect(lookupError).toBeGreaterThan(-1);
    expect(mappingFailure).toBeGreaterThan(lookupError);
    expect(tokenRead).toBeGreaterThan(mappingFailure);
    expect(exportCall).toBeGreaterThan(tokenRead);
  });

  test("keeps the lookup scoped to the authenticated creator and design", () => {
    const lookupStart = source.indexOf('.from("canva_design_products")');
    const lookupEnd = source.indexOf("if (existingMappingError)", lookupStart);
    const lookup = source.slice(lookupStart, lookupEnd);

    expect(lookup).toContain('.eq("user_id", context.userId)');
    expect(lookup).toContain('.eq("canva_design_id", designId)');
  });
});
