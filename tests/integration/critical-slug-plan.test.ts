import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repo = process.cwd();
const plan = JSON.parse(
  readFileSync(join(repo, "scripts/seo/critical-slug-plan.json"), "utf8"),
) as {
  version: number;
  scope: string;
  expected_count: number;
  products: Array<{
    product_id: string;
    title: string;
    old_slug?: string;
    capture_current_slug?: boolean;
    require_current_slug_min_length?: number;
    new_slug: string;
  }>;
};

const applySql = readFileSync(
  join(repo, "scripts/seo/critical-slug-cleanup.sql"),
  "utf8",
);
const preflightSql = readFileSync(
  join(repo, "scripts/seo/critical-slug-preflight.sql"),
  "utf8",
);
const postflightSql = readFileSync(
  join(repo, "scripts/seo/critical-slug-postflight.sql"),
  "utf8",
);
const emergencyRevertSql = readFileSync(
  join(repo, "scripts/seo/critical-slug-emergency-revert.sql"),
  "utf8",
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("critical product slug migration plan", () => {
  it("contains exactly 17 unique critical products and unique clean targets", () => {
    expect(plan.version).toBe(1);
    expect(plan.scope).toBe("critical-only");
    expect(plan.expected_count).toBe(17);
    expect(plan.products).toHaveLength(17);

    const ids = plan.products.map((p) => p.product_id);
    const targets = plan.products.map((p) => p.new_slug);

    expect(new Set(ids).size).toBe(17);
    expect(new Set(targets).size).toBe(17);
    for (const product of plan.products) {
      expect(product.product_id).toMatch(UUID_RE);
      expect(product.title.trim().length).toBeGreaterThan(0);
      expect(product.new_slug).toMatch(SLUG_RE);
      if (product.old_slug) {
        expect(product.old_slug).toMatch(SLUG_RE);
        expect(product.old_slug).not.toBe(product.new_slug);
      }
    }
  });

  it("has exactly one guarded dynamic old-slug capture for the malformed legacy URL", () => {
    const dynamic = plan.products.filter((p) => p.capture_current_slug);
    expect(dynamic).toHaveLength(1);
    expect(dynamic[0].product_id).toBe(
      "cde06c9c-80a7-4c82-a30f-fa1a8ec58831",
    );
    expect(dynamic[0].require_current_slug_min_length).toBeGreaterThanOrEqual(
      500,
    );
    expect(dynamic[0].new_slug).toBe(
      "interactive-social-media-content-planner",
    );
  });

  it("keeps mutation SQL manual-only and fail-closed", () => {
    expect(applySql).toContain("MANUAL PRODUCTION APPROVAL REQUIRED");
    expect(applySql).toContain("NEVER move this file into supabase/migrations");
    expect(applySql).toContain("begin;");
    expect(applySql).toContain("for update;");
    expect(applySql).toContain("product_slug_redirects");
    expect(applySql).toContain("on conflict (old_slug_key) do nothing");
    expect(applySql).toContain("raise exception");
    expect(applySql).toContain("commit;");
  });

  it("ships separate preflight and postflight audits", () => {
    expect(preflightSql).toContain("then 'SAFE'");
    expect(preflightSql).toContain("else 'BLOCKED'");
    expect(preflightSql).not.toMatch(/\bupdate\s+public\.marketplace_products\b/i);
    expect(preflightSql).not.toMatch(/\binsert\s+into\s+public\.product_slug_redirects\b/i);

    expect(postflightSql).toContain("then 'PASS'");
    expect(postflightSql).toContain("historical_redirects_present");
    expect(postflightSql).not.toMatch(/\bupdate\s+public\.marketplace_products\b/i);
  });

  it("makes emergency rollback preserve the new URLs before restoring old slugs", () => {
    expect(emergencyRevertSql).toContain("EMERGENCY ONLY");
    expect(emergencyRevertSql).toContain("Preserve the current/new URLs");
    expect(emergencyRevertSql).toContain("on conflict (old_slug_key) do nothing");
    expect(emergencyRevertSql).toContain("expected 17 new-url aliases");
  });

  it("does not permit slug cleanup/backfill SQL in automatic migrations", () => {
    const migrations = readdirSync(join(repo, "supabase/migrations"));
    const dangerous = migrations.filter((name) =>
      /(slug.*(cleanup|rename|backfill)|(cleanup|rename|backfill).*slug)/i.test(
        name,
      ),
    );
    expect(dangerous).toEqual([]);
  });
});
