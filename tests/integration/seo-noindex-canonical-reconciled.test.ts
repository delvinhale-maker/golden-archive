/**
 * Static regression guard for the SEO noindex/canonical fixes reconciled
 * onto current main. Deliberately does NOT re-assert the old robots.txt
 * content wholesale — main's public/robots.txt has evolved independently
 * (Disallow list, faceted-URL wildcard rules, no more dual robots.txt
 * source) into a more comprehensive, intentional file; only the one
 * additive line (/refer) from this reconciliation is checked here.
 *
 * Run: bun test tests/integration/seo-noindex-canonical-reconciled.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("robots.txt", () => {
  it("the dynamic src/routes/robots[.]txt.ts route no longer exists (main removed the dual-source ambiguity)", () => {
    expect(existsSync(join(ROOT, "src/routes/robots[.]txt.ts"))).toBe(false);
  });

  it("/refer is disallowed (ssr:false auth guard makes its noindex tag unreliable to observe, same rationale as /library)", () => {
    const robots = read("public/robots.txt");
    const disallowed = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]);
    expect(disallowed).toContain("/refer");
    expect(disallowed).toContain("/library"); // pre-existing, same rationale — regression guard
  });
});

describe("reliably-SSR'd private routes carry explicit noindex", () => {
  const cases: Array<[string, string]> = [
    ["src/routes/account.tsx", "noindex, follow"],
    ["src/routes/wishlist.tsx", "noindex, follow"],
    ["src/routes/download.$token.tsx", "noindex, follow"],
    ["src/routes/a.$brandSlug.tsx", "noindex, follow"],
  ];
  for (const [file, expected] of cases) {
    it(`${file} declares robots: "${expected}"`, () => {
      const src = read(file);
      const m = src.match(/name:\s*"robots",\s*content:\s*"([^"]+)"/);
      expect(m, `no robots meta found in ${file}`).not.toBeNull();
      expect(m![1]).toBe(expected);
    });
  }
});

describe("Kingdom Picks canonical", () => {
  it("declares a self-referencing canonical link", () => {
    const src = read("src/routes/kingdom-picks.tsx");
    expect(src).toContain('rel: "canonical", href: "https://www.aurumvault.store/kingdom-picks"');
  });

  it("preserves main's independently-added 'Vault Finds' filter and existing metadata", () => {
    const src = read("src/routes/kingdom-picks.tsx");
    expect(src).toContain("Vault Finds");
    expect(src).toContain("Kingdom Picks — Curated Resources | AurumVault");
  });
});
