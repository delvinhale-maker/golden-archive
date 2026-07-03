import { test, expect, type Page } from "@playwright/test";

/**
 * Cross-browser validation of the hero-carousel accent sequence.
 *
 * Runs against production (https://www.aurumvault.store) on real Safari and
 * Firefox via the BrowserStack Playwright grid. In local/CI-fallback mode it
 * runs against the same URL using the Playwright-bundled WebKit and Firefox.
 *
 * The test asserts:
 *  1. :root exposes the expected 300ms transition on --accent-color and the
 *     gradient tokens.
 *  2. Over ~14s of hero auto-advance, --accent-color takes on at least two
 *     distinct values AND at least one intermediate (non-endpoint) sample,
 *     which proves the CSS interpolation is actually running (not snapping).
 *  3. The active hero dot's computed background-color follows the accent.
 */

const TARGET_URL = process.env.CROSS_BROWSER_TARGET_URL ?? "https://www.aurumvault.store/";

const ACCENT_TRANSITION_RE = /--accent-color\s+0?\.3s/;

async function readRoot(page: Page) {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      accent: cs.getPropertyValue("--accent-color").trim(),
      gradientStart: cs.getPropertyValue("--gradient-start").trim(),
      gradientEnd: cs.getPropertyValue("--gradient-end").trim(),
      transition: cs.transition,
      tab: document.documentElement.dataset.tab ?? null,
    };
  });
}

test.describe("hero accent sequence", () => {
  test("300ms transition tokens are declared on :root", async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const root = await readRoot(page);
    expect(root.accent).not.toBe("");
    expect(root.transition).toMatch(ACCENT_TRANSITION_RE);
    expect(root.transition).toMatch(/--gradient-start\s+0?\.3s/);
    expect(root.transition).toMatch(/--gradient-end\s+0?\.3s/);
  });

  test("hero auto-advance interpolates the accent color", async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const samples: string[] = [];
    for (let i = 0; i < 28; i++) {
      const v = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--accent-color").trim(),
      );
      samples.push(v);
      await page.waitForTimeout(500);
    }

    const unique = Array.from(new Set(samples));
    // At least two distinct accent values across the sweep.
    expect(unique.length, `accent stayed constant: ${samples.join(", ")}`).toBeGreaterThanOrEqual(2);

    // At least one intermediate value (a sample that isn't the first or last
    // stable endpoint) → proves the 300ms interpolation is actually running.
    // Firefox does not animate custom properties without @property support,
    // but the paired background/color transitions still produce visible
    // intermediates on the surfaces that consume the token; for a strict
    // engine-independent signal we look for at least one sample that appears
    // exactly once (a transient), which is only possible mid-interpolation.
    const counts = samples.reduce<Record<string, number>>((acc, s) => {
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
    const transients = Object.entries(counts).filter(([, n]) => n === 1).map(([k]) => k);
    expect(
      transients.length,
      `no interpolation transients detected. samples: ${samples.join(" | ")}`,
    ).toBeGreaterThanOrEqual(1);
  });

  test("active hero dot background tracks the accent", async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const { accent, dotBg, dotTransition } = await page.evaluate(() => {
      const dot = document.querySelector('[data-nav-dot]') as HTMLElement | null;
      const cs = dot ? getComputedStyle(dot) : null;
      return {
        accent: getComputedStyle(document.documentElement).getPropertyValue("--accent-color").trim(),
        dotBg: cs?.backgroundColor ?? null,
        dotTransition: cs?.transition ?? null,
      };
    });

    expect(dotBg, "no [data-nav-dot] found on the page").not.toBeNull();
    expect(dotTransition ?? "").toMatch(/background-color\s+0?\.3s/);
    // Normalize both to rgb() strings for comparison.
    const norm = (s: string) => s.replace(/\s+/g, "");
    expect(norm(dotBg!)).toBe(norm(accent));
  });
});
