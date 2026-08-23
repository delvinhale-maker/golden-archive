/**
 * Static regression guard for the description-quality authoring changes in
 * dashboard.new.tsx, reconciled onto main's current file (grown further —
 * subcategory/product-type/delivery-contents fields — but the DESC_MIN
 * validation pattern itself was unchanged from what this fix targets).
 *
 * Run: bun test tests/integration/description-quality-reconciled.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const src = readFileSync(join(ROOT, "src/routes/_authenticated/dashboard.new.tsx"), "utf8");

describe("description authoring quality", () => {
  it("raises the minimum into the 120-160 char range for new listings", () => {
    const m = src.match(/const DESC_MIN = (\d+);/);
    expect(m, "DESC_MIN constant not found").not.toBeNull();
    const min = Number(m![1]);
    expect(min).toBeGreaterThanOrEqual(120);
    expect(min).toBeLessThanOrEqual(160);
  });

  it("keeps the old floor available for legacy listings instead of a hard word-count gate", () => {
    expect(src).toContain("const LEGACY_DESC_MIN = 50");
    expect(src).toContain("const effectiveDescMin = isEditing ? LEGACY_DESC_MIN : DESC_MIN");
  });

  it("does not block saving an existing listing purely because of the raised threshold", () => {
    expect(src).toMatch(/step1Valid =[\s\S]{0,140}descTrimLen >= effectiveDescMin/);
  });

  it("the publish checklist and the live counter both reflect the effective, not raw, minimum", () => {
    expect(src).toContain("descTrimLen >= effectiveDescMin && descLen <= DESC_MAX");
    expect(src).toContain("<DescriptionCounter value={p.description} min={p.descMin} />");
    expect(src).toContain("descMin={effectiveDescMin}");
  });

  it("provides inline authoring guidance next to the description field", () => {
    expect(src).toMatch(/who it's for.*problem it solves.*what's included.*how it's used/i);
  });

  it("does not force artificial keyword repetition in the guidance copy", () => {
    const m = src.match(/Cover who it's for[^<]*/);
    expect(m).not.toBeNull();
    const guidance = m![0];
    const words = guidance.toLowerCase().match(/[a-z]{4,}/g) ?? [];
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    for (const [, n] of counts) expect(n).toBeLessThan(3);
  });
});
