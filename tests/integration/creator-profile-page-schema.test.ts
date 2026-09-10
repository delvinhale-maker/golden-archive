import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/routes/store.$slug.tsx"), "utf8");

describe("creator storefront structured data", () => {
  it("uses ProfilePage with nested Person mainEntity", () => {
    expect(source).toContain('"@type": "ProfilePage"');
    expect(source).toContain("mainEntity:");
    expect(source).toContain('"@type": "Person"');
  });

  it("does not claim marketplace creators work for AurumVault", () => {
    expect(source).not.toContain("worksFor:");
  });
});
