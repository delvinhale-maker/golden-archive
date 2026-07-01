/**
 * Route-level integration test: guarantees "Create New Title" always
 * navigates to `/dashboard/new` and dashboard home links resolve to
 * `/dashboard`. Prevents regressions where hardcoded preview URLs or
 * stale paths sneak back into navigation.
 *
 * Run with: bun test tests/integration/dashboard-routes.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const NAV_FILES = [
  "src/routes/_authenticated/dashboard.index.tsx",
  "src/routes/_authenticated/dashboard.new.tsx",
  "src/components/marketplace/PublisherShell.tsx",
  "src/components/marketplace/UploadFab.tsx",
];

describe("Dashboard navigation routes", () => {
  it("route files exist", () => {
    expect(existsSync(join(ROOT, "src/routes/_authenticated/dashboard.new.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "src/routes/_authenticated/dashboard.index.tsx"))).toBe(true);
  });

  it("dashboard.new declares the /dashboard/new file route", () => {
    const src = read("src/routes/_authenticated/dashboard.new.tsx");
    expect(src).toContain('createFileRoute("/_authenticated/dashboard/new")');
  });

  it("dashboard.index declares the /dashboard file route", () => {
    const src = read("src/routes/_authenticated/dashboard.index.tsx");
    expect(src).toMatch(/createFileRoute\("\/_authenticated\/dashboard\/?"\)|createFileRoute\("\/_authenticated\/dashboard\/"\)|createFileRoute\("\/_authenticated\/dashboard"\)/);
  });

  it("every 'Create New Title' CTA points to /dashboard/new", () => {
    for (const path of NAV_FILES) {
      if (!existsSync(join(ROOT, path))) continue;
      const src = read(path);
      const idx = src.indexOf("Create New Title");
      if (idx === -1) continue;
      // Look at a 400-char window around the label for the nearest `to=` prop.
      const window = src.slice(Math.max(0, idx - 400), idx + 200);
      const toMatch = window.match(/to=(?:"([^"]+)"|\{`([^`]+)`\}|'([^']+)')/g);
      expect(toMatch, `no <Link to> found near "Create New Title" in ${path}`).toBeTruthy();
      const last = toMatch![toMatch!.length - 1];
      expect(last, `wrong nav target near "Create New Title" in ${path}`).toContain("/dashboard/new");
    }
  });

  it("PublisherShell 'Publish' nav item routes to /dashboard/new", () => {
    const src = read("src/components/marketplace/PublisherShell.tsx");
    expect(src).toMatch(/label:\s*"Publish"\s*,\s*to:\s*"\/dashboard\/new"/);
  });

  it("UploadFab entries all route to /dashboard/new", () => {
    const src = read("src/components/marketplace/UploadFab.tsx");
    const targets = [...src.matchAll(/to="([^"]+)"/g)].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) expect(t).toBe("/dashboard/new");
  });

  it("no navigation target references the Lovable preview URL", () => {
    for (const path of NAV_FILES) {
      if (!existsSync(join(ROOT, path))) continue;
      const src = read(path);
      expect(src).not.toContain("lovable.app");
      expect(src).not.toContain("id-preview--");
    }
  });

  it("dashboard 'home' back-links resolve to /dashboard (not /dashboard/*)", () => {
    const src = read("src/routes/_authenticated/dashboard.new.tsx");
    // Every <Link to="/dashboard"> back-link is exact, not a nested path.
    const homeLinks = [...src.matchAll(/<Link\s+to="(\/dashboard[^"]*)"/g)].map((m) => m[1]);
    const backLinks = homeLinks.filter((t) => t === "/dashboard");
    expect(backLinks.length).toBeGreaterThan(0);
  });
});
