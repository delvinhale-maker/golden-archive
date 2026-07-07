#!/usr/bin/env node
/**
 * HeroCarousel CTA contrast smoke test.
 *
 * For every slide in the HeroCarousel, measures the primary CTA
 * (the `hover:brightness-110` span rendered from HeroCarousel.tsx)
 * in both its base and `:hover` states and asserts WCAG contrast:
 *
 *   - AA_NORMAL = 4.5:1  (button text is text-sm font-bold, treated as normal)
 *   - AA_LARGE  = 3.0:1  (reported for context only)
 *
 * The `:hover` state is triggered deterministically via CDP
 * (`CSS.forcePseudoState`) so the check does not depend on cursor
 * position or transition timing.
 *
 * Usage:
 *   node scripts/check-hero-cta-contrast.mjs                 # tests localhost:8080
 *   BASE_URL=https://www.aurumvault.store node scripts/...   # tests published site
 *   HEADLESS=false node scripts/...                          # watch it run
 *
 * Exit code:
 *   0 — every slide passes AA_NORMAL in both base and hover
 *   1 — one or more slides fails, or the CTA cannot be found
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const HEADLESS = process.env.HEADLESS !== "false";
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;
const MAX_SLIDES = 8;
const CTA_SELECTOR =
  "span.transition-\\[filter\\].hover\\:brightness-110, span[class*='hover:brightness-110']";

function parseRgb(str) {
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`cannot parse color: ${str}`);
  const [r, g, b] = m[1].split(",").map((s) => Number(s.trim()));
  return { r, g, b };
}

function relativeLuminance({ r, g, b }) {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

function applyFilterToColor({ r, g, b }, filter) {
  // Only supports `brightness(N)` / `brightness(N%)`; returns the input for `none`.
  if (!filter || filter === "none") return { r, g, b };
  const m = filter.match(/brightness\(([\d.]+)(%?)\)/);
  if (!m) return { r, g, b };
  const factor = m[2] === "%" ? Number(m[1]) / 100 : Number(m[1]);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

async function measureCta(page, cdp, label) {
  await page.waitForSelector(CTA_SELECTOR, { timeout: 5000 });

  const base = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, color: s.color, filter: s.filter, text: el.innerText.trim() };
  }, CTA_SELECTOR);
  if (!base) throw new Error(`[${label}] HeroCarousel CTA not found`);

  // Force :hover deterministically via CDP.
  const { root } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: CTA_SELECTOR,
  });
  let hover = base;
  if (nodeId) {
    try {
      await cdp.send("CSS.forcePseudoState", {
        nodeId,
        forcedPseudoClasses: ["hover"],
      });
      await page.waitForTimeout(120);
      hover = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, color: s.color, filter: s.filter };
      }, CTA_SELECTOR);
      await cdp
        .send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] })
        .catch(() => {});
    } catch {
      // Node vanished mid-measurement (Framer Motion re-render or autoplay
      // race). Compute hover styles ourselves from the class list.
      hover = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const s = getComputedStyle(el);
        // If the button uses hover:brightness-110, synthesize the hover filter.
        const filter = (el.className || "").toString().includes("brightness-110")
          ? "brightness(1.1)"
          : s.filter;
        return { bg: s.backgroundColor, color: s.color, filter };
      }, CTA_SELECTOR);
      if (!hover) hover = base;
    }
  }

  const fg = parseRgb(base.color);
  const bgBase = parseRgb(base.bg);
  const bgHover = applyFilterToColor(parseRgb(hover.bg), hover.filter);

  return {
    text: base.text,
    base: { fg, bg: bgBase, ratio: contrastRatio(fg, bgBase) },
    hover: { fg, bg: bgHover, ratio: contrastRatio(fg, bgHover), filter: hover.filter },
  };
}

function fmt({ r, g, b }) {
  const hex = (v) => v.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

async function advanceSlide(page) {
  const before = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).backgroundColor : null;
  }, CTA_SELECTOR);
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector(
      'button[aria-label*="Next" i], button[aria-label*="next slide" i]',
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!clicked) return false;
  try {
    await page.waitForFunction(
      ({ sel, prev }) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return getComputedStyle(el).backgroundColor !== prev;
      },
      { sel: CTA_SELECTOR, prev: before },
      { timeout: 2500 },
    );
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Prefer an explicit CHROMIUM_PATH; otherwise probe common system paths
  // (Nix-wrapped `/bin/chromium` works in the sandbox where the bundled
  // headless-shell can't resolve libglib). Fall back to Playwright's default.
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].filter(Boolean);
  const executablePath = candidates.find((p) => existsSync(p));
  const browser = await chromium.launch({ headless: HEADLESS, executablePath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");

  await page.goto(BASE_URL, { waitUntil: "networkidle" }).catch(async () => {
    // Some dev servers keep long-lived HMR sockets open; fall back to load.
    await page.goto(BASE_URL, { waitUntil: "load" });
  });
  await page.waitForSelector(CTA_SELECTOR, { timeout: 15_000 });
  await page.waitForTimeout(300);
  // Pause the carousel's 5s autoplay so slide-index measurements are stable.
  await page
    .evaluate(() => {
      const el = document.querySelector('[aria-roledescription="carousel"]');
      if (el) el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    })
    .catch(() => {});
  await page.waitForTimeout(200);

  const results = [];
  const seenBgs = new Set();
  let attempts = 0;
  const maxAttempts = MAX_SLIDES * 2;

  while (attempts < maxAttempts) {
    attempts += 1;
    // Give Framer Motion transitions (0.5s) time to settle before measuring
    // so we sample the stable slide color, not an in-between frame.
    await page.waitForTimeout(700);
    const r = await measureCta(page, cdp, `attempt ${attempts}`);
    const key = fmt(r.base.bg);
    if (seenBgs.has(key)) {
      if (results.length > 0) break; // carousel wrapped
    } else {
      seenBgs.add(key);
      results.push({ slide: results.length + 1, ...r });
    }
    await advanceSlide(page);
  }

  await browser.close();

  let failed = 0;
  console.log(`\nHeroCarousel CTA contrast (target: AA ≥ ${AA_NORMAL}:1 for normal text)`);
  console.log("─".repeat(72));
  for (const r of results) {
    const baseOk = r.base.ratio >= AA_NORMAL;
    const hoverOk = r.hover.ratio >= AA_NORMAL;
    const baseLargeOk = r.base.ratio >= AA_LARGE;
    const status = baseOk && hoverOk ? "PASS" : "FAIL";
    if (!baseOk || !hoverOk) failed += 1;
    console.log(
      `slide ${r.slide} "${r.text}" [${status}]\n` +
        `  base : fg ${fmt(r.base.fg)} on bg ${fmt(r.base.bg)}  → ${r.base.ratio.toFixed(2)}:1` +
        `  ${baseOk ? "AA" : baseLargeOk ? "AA-large only" : "FAIL"}\n` +
        `  hover: fg ${fmt(r.hover.fg)} on bg ${fmt(r.hover.bg)}  → ${r.hover.ratio.toFixed(2)}:1` +
        `  ${hoverOk ? "AA" : "below AA"}   (filter: ${r.hover.filter})`,
    );
  }
  console.log("─".repeat(72));
  if (results.length === 0) {
    console.error("No HeroCarousel CTA measured — selector missed.");
    process.exit(1);
  }
  if (failed > 0) {
    console.error(`${failed} slide(s) failed AA. See report above.`);
    process.exit(1);
  }
  console.log(`All ${results.length} slide(s) pass AA in base and hover.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
