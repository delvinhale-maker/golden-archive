import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const index = read("src/routes/index.tsx");
const newReleases = read("src/components/marketplace/NewReleasesRow.tsx");
const kingdomPicks = read("src/components/marketplace/KingdomPicksRow.tsx");

describe("current homepage layout contract", () => {
  it("keeps the current configurable premium homepage section order", () => {
    for (const key of [
      '"new_releases"',
      '"kingdom_picks"',
      '"academy_latest"',
      '"category_grid"',
      '"featured_products"',
      '"curated_bundles"',
    ]) {
      expect(index).toContain(key);
    }
  });

  it("renders the current New Releases presentation as Just Dropped", () => {
    expect(newReleases).toContain("Just Dropped");
    expect(newReleases).toContain("getNewReleasesRowFn");
    expect(newReleases).not.toContain("SPONSORED — ILLUSTRIOUS CAPITAL");
  });

  it("keeps Editor's Picks as the current partner recommendation surface", () => {
    expect(kingdomPicks).toContain("EDITOR'S PICKS");
    expect(kingdomPicks).toContain("Editor's Picks");
    expect(kingdomPicks).toContain('rel="noopener noreferrer sponsored"');
  });

  it("does not mount the retired HomeContentRows composition", () => {
    expect(index).not.toContain("<HomeContentRows");
  });
});
