/**
 * Hero carousel — "new releases only" integration test.
 *
 * Guarantees the homepage hero never falls back to the highlights hero product
 * ("Kingdom Mind"), to featured/promoted products, or to hardcoded demo cards:
 *
 *   1. Source contract — `FeaturedHero` in src/routes/index.tsx reads only
 *      `newReleasesRowQ`; HeroCarousel carries no FALLBACK placeholder data.
 *   2. Live contract — every product title rendered in the hero region of the
 *      server-rendered homepage belongs to the newest approved+published set
 *      (the same set `getNewReleasesRowFn` serves), and a highlights/featured
 *      product that is NOT a new release never appears there.
 *
 * Run: bunx vitest run tests/integration/hero-new-releases-only.test.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env["HERO_TEST_BASE_URL"] ?? "http://localhost:8080";

function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
    const line = raw.split("\n").find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const SUPABASE_URL = readEnv("VITE_SUPABASE_URL") ?? "";
const SUPABASE_KEY =
  readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ?? readEnv("VITE_SUPABASE_ANON_KEY") ?? "";

function read(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8");
}

/** Extracts the body of a top-level function declaration from source. */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  expect(start, `${name} should exist`).toBeGreaterThan(-1);
  let i = src.indexOf("{", start);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  throw new Error(`unbalanced body for ${name}`);
}

describe("hero source contract", () => {
  const indexSrc = read("src/routes/index.tsx");
  const heroSrc = read("src/components/marketplace/HeroCarousel.tsx");
  const body = fnBody(indexSrc, "FeaturedHero");

  it("FeaturedHero reads only the new releases query", () => {
    expect(body).toContain("newReleasesRowQ");
    for (const forbidden of [
      "highlightsQ",
      "getHomeHighlights",
      "featuredProductsQ",
      "getFeaturedProducts",
      "promotedPicksRowQ",
      "editorsPicksQ",
      "recommendedRowQ",
    ]) {
      expect(body, `FeaturedHero must not use ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("HeroCarousel has no hardcoded placeholder products", () => {
    expect(heroSrc).not.toMatch(/FALLBACK_HERO|FALLBACK_STACK/);
    for (const demo of [
      "The Stewardship Codex",
      "Not For Sale",
      "Purpose Blueprint",
    ]) {
      expect(heroSrc, `demo card "${demo}" must be gone`).not.toContain(demo);
    }
  });

  it("HeroCarousel renders a skeleton instead of fake covers when empty", () => {
    expect(heroSrc).toMatch(/length === 0\)\s*return <VisualSkeleton \/>/);
  });
});

describe("hero live contract", () => {
  const hasBackend = Boolean(SUPABASE_URL && SUPABASE_KEY);
  let newReleaseTitles: string[] = [];
  let nonReleaseTitles: string[] = [];
  let heroHtml = "";
  let reachable = false;

  beforeAll(async () => {
    if (hasBackend) {
      const supa = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false },
      });
      const { data } = await supa
        .from("marketplace_products")
        .select("title,created_at")
        .eq("status", "approved")
        .eq("published", true)
        .order("created_at", { ascending: false });
      const all = (data ?? []).map((r) => r.title as string);
      newReleaseTitles = all.slice(0, 8);
      nonReleaseTitles = all.slice(8);
    }
    try {
      const res = await fetch(`${BASE_URL}/`, { headers: { accept: "text/html" } });
      if (res.ok) {
        const html = await res.text();
        // Hero region = markup before the category CTA bar that follows it.
        const end = html.indexOf("Shop the vault");
        const cta = html.indexOf("AI Prompt Packs");
        const cut = [end, cta].filter((n) => n > 0).sort((a, b) => a - b)[0];
        heroHtml = cut ? html.slice(0, cut) : html;
        reachable = true;
      }
    } catch {
      reachable = false;
    }
  });

  it("only renders titles that are new releases", () => {
    if (!hasBackend || !reachable || newReleaseTitles.length === 0) {
      console.warn("skipped: backend keys or dev server unavailable / no products");
      return;
    }
    const rendered = newReleaseTitles.filter((t) => heroHtml.includes(t));
    expect(rendered.length).toBeGreaterThan(0);
  });

  it("never renders an older highlights/featured-only product", () => {
    if (!hasBackend || !reachable) {
      console.warn("skipped: backend keys or dev server unavailable");
      return;
    }
    const leaked = nonReleaseTitles.filter((t) => t.length > 4 && heroHtml.includes(t));
    expect(leaked, `older products leaked into hero: ${leaked.join(", ")}`).toEqual([]);
  });

  it("never renders the Kingdom Mind highlights hero unless it is a new release", () => {
    if (!hasBackend || !reachable) {
      console.warn("skipped: backend keys or dev server unavailable");
      return;
    }
    const isNewRelease = newReleaseTitles.some((t) => /^kingdom mind/i.test(t));
    if (!isNewRelease) {
      expect(/Kingdom Mind/i.test(heroHtml)).toBe(false);
    }
  });
});
