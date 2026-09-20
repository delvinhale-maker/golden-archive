/**
 * Controlled beta activation gate tests: cohort allowlist parsing plus a source
 * scan proving EVERY audiobook server function runs the cohort check after the
 * feature gate and auth.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseBetaAllowlist, isInBetaAllowlist } from "./audiobook-beta-cohort.middleware";

describe("beta allowlist parsing", () => {
  it("is empty and fail-closed when unset", () => {
    expect(parseBetaAllowlist(undefined)).toEqual([]);
    expect(isInBetaAllowlist("u1", undefined)).toBe(false);
    expect(isInBetaAllowlist("u1", "")).toBe(false);
  });

  it("matches only exact listed ids", () => {
    expect(isInBetaAllowlist("u1", " u1 , u2 ")).toBe(true);
    expect(isInBetaAllowlist("u3", "u1,u2")).toBe(false);
  });
});

describe("server function cohort gating", () => {
  const dir = join(process.cwd(), "src/lib");
  const files = readdirSync(dir).filter(
    (f) => f.startsWith("audiobook-") && f.endsWith(".functions.ts"),
  );

  it("covers every audiobook server function module", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} gates every server function with the beta cohort`, () => {
      const src = readFileSync(join(dir, file), "utf8");
      const arrays = src.match(/\.middleware\(\[[^\]]*\]\)/g) ?? [];
      expect(arrays.length).toBeGreaterThan(0);
      for (const arr of arrays) {
        expect(arr).toContain("requireAudiobookStudioEnabled");
        expect(arr).toContain("requireSupabaseAuth");
        expect(arr).toContain("requireAudiobookBetaCohort");
        expect(arr.indexOf("requireSupabaseAuth")).toBeLessThan(
          arr.indexOf("requireAudiobookBetaCohort"),
        );
      }
    });
  }
});