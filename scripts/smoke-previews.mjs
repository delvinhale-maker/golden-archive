#!/usr/bin/env node
/**
 * Automated preview smoke test.
 *
 * Opens a set of product pages on the target site, clicks the format-specific
 * preview button, and asserts that the FormatPreviewModal renders the expected
 * content for each file type (PDF, EPUB, DOCX, audio, video).
 *
 * Products are discovered from the public marketplace catalog: the script
 * fetches /products?type={format} for each format we support, picks the first
 * product with a matching file extension, and drives it through the preview
 * flow on both desktop and mobile viewports. If no product is available for a
 * given format (common for audio/video early on), that format is skipped with
 * a warning rather than failing the run.
 *
 * Usage:
 *   node scripts/smoke-previews.mjs                       # tests production
 *   BASE_URL=https://preview.example.lovable.app node ... # tests a preview
 *   PRODUCT_PDF=<uuid> PRODUCT_EPUB=<uuid> ... node ...   # override picks
 *
 * Exit code:
 *   0 — every discovered format passed
 *   1 — one or more discovered formats failed to render a preview
 */
import { chromium } from "playwright";

const BASE_URL = (process.env.BASE_URL ?? "https://www.aurumvault.store").replace(/\/$/, "");
const HEADLESS = process.env.HEADLESS !== "false";
const CLICK_TIMEOUT_MS = 15_000;
const MODAL_TIMEOUT_MS = 20_000;

/** Format catalog: label regex to find the button, and a modal-content check. */
const FORMATS = [
  {
    key: "pdf",
    exts: ["pdf"],
    envOverride: "PRODUCT_PDF",
    buttonLabel: /preview inside/i,
    modalHeader: /pdf sample pages/i,
    // Headless Chromium has no PDF plugin; assert the blob iframe is wired up.
    async assertContent(page) {
      const iframe = page.locator('iframe[src^="blob:"]').first();
      await iframe.waitFor({ state: "attached", timeout: MODAL_TIMEOUT_MS });
      const box = await iframe.boundingBox();
      if (!box || box.width < 200 || box.height < 200) {
        throw new Error(`PDF iframe too small: ${JSON.stringify(box)}`);
      }
    },
  },
  {
    key: "epub",
    exts: ["epub"],
    envOverride: "PRODUCT_EPUB",
    buttonLabel: /read the first chapter/i,
    modalHeader: /first chapter/i,
    async assertContent(page) {
      // First-chapter HTML should be non-trivial in length.
      const modal = page.getByRole("dialog").first();
      await modal.waitFor({ timeout: MODAL_TIMEOUT_MS });
      const text = (await modal.innerText()).trim();
      if (text.length < 400) {
        throw new Error(`EPUB chapter text too short (${text.length} chars)`);
      }
    },
  },
  {
    key: "docx",
    exts: ["docx"],
    envOverride: "PRODUCT_DOCX",
    buttonLabel: /read a text excerpt/i,
    modalHeader: /text excerpt/i,
    async assertContent(page) {
      const modal = page.getByRole("dialog").first();
      await modal.waitFor({ timeout: MODAL_TIMEOUT_MS });
      const text = (await modal.innerText()).trim();
      if (text.length < 400) {
        throw new Error(`DOCX excerpt too short (${text.length} chars)`);
      }
    },
  },
  {
    key: "audio",
    exts: ["mp3", "m4a", "wav", "ogg", "aac", "flac"],
    envOverride: "PRODUCT_AUDIO",
    buttonLabel: /listen to a 60s sample/i,
    modalHeader: /audio sample/i,
    async assertContent(page) {
      await page.locator("audio").first().waitFor({ timeout: MODAL_TIMEOUT_MS });
    },
  },
  {
    key: "video",
    exts: ["mp4", "webm", "mov", "m4v"],
    envOverride: "PRODUCT_VIDEO",
    buttonLabel: /watch a 60s clip/i,
    modalHeader: /video clip/i,
    async assertContent(page) {
      await page.locator("video").first().waitFor({ timeout: MODAL_TIMEOUT_MS });
    },
  },
];

const VIEWPORTS = [
  { key: "desktop", size: { width: 1280, height: 1800 } },
  { key: "mobile", size: { width: 390, height: 844 } },
];

/**
 * Discover a product id per format by scraping the public listing page. The
 * catalog page renders product cards linking to `/products/<id>`; we visit
 * each and read the fileExt from the product JSON via `<script type="application/ld+json">`
 * when available, or fall back to opening the product page and inspecting the
 * preview button label.
 */
async function discoverProducts(page) {
  const found = {};
  // Env overrides win: skip discovery for any format explicitly pinned.
  for (const f of FORMATS) {
    const override = process.env[f.envOverride];
    if (override) found[f.key] = override;
  }

  const remaining = FORMATS.filter((f) => !found[f.key]);
  if (remaining.length === 0) return found;

  await page.goto(`${BASE_URL}/products`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1500);

  const ids = await page.$$eval('a[href^="/products/"]', (as) =>
    Array.from(
      new Set(
        as
          .map((a) => a.getAttribute("href"))
          .filter(Boolean)
          .map((h) => h.match(/^\/products\/([0-9a-f-]{36})/i)?.[1])
          .filter(Boolean),
      ),
    ),
  );

  // Probe each candidate product page and read the preview button label. Stop
  // as soon as every remaining format has a match.
  for (const id of ids) {
    if (remaining.every((f) => found[f.key])) break;
    try {
      const probe = await page.context().newPage();
      await probe.goto(`${BASE_URL}/products/${id}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await probe.waitForTimeout(800);
      const labels = await probe.$$eval("button", (bs) => bs.map((b) => (b.textContent || "").trim()));
      for (const f of remaining) {
        if (found[f.key]) continue;
        if (labels.some((l) => f.buttonLabel.test(l))) found[f.key] = id;
      }
      await probe.close();
    } catch {
      /* keep scanning */
    }
  }

  return found;
}

async function runOne(browser, format, productId, viewport) {
  const ctx = await browser.newContext({ viewport: viewport.size });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

  try {
    await page.goto(`${BASE_URL}/products/${productId}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1500);

    const btn = page.getByRole("button", { name: format.buttonLabel }).first();
    await btn.waitFor({ timeout: CLICK_TIMEOUT_MS });
    await btn.click();

    await page.getByText(format.modalHeader).first().waitFor({ timeout: MODAL_TIMEOUT_MS });
    await format.assertContent(page);
    return { ok: true, errors };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), errors };
  } finally {
    await ctx.close();
  }
}

async function main() {
  console.log(`[smoke] target: ${BASE_URL}`);
  const browser = await chromium.launch({ headless: HEADLESS });
  const discoveryCtx = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const discoveryPage = await discoveryCtx.newPage();
  const products = await discoverProducts(discoveryPage);
  await discoveryCtx.close();

  console.log(`[smoke] discovered products:`, products);

  const results = [];
  for (const format of FORMATS) {
    const id = products[format.key];
    if (!id) {
      console.log(`[smoke] ${format.key}: SKIP (no product available in catalog)`);
      results.push({ format: format.key, viewport: "-", status: "skip" });
      continue;
    }
    for (const vp of VIEWPORTS) {
      const label = `${format.key}/${vp.key}`;
      process.stdout.write(`[smoke] ${label}: running... `);
      const r = await runOne(browser, format, id, vp);
      if (r.ok) {
        console.log("PASS");
        results.push({ format: format.key, viewport: vp.key, status: "pass" });
      } else {
        console.log(`FAIL — ${r.error}`);
        if (r.errors?.length) console.log(`  page errors: ${r.errors.slice(0, 3).join(" | ")}`);
        results.push({ format: format.key, viewport: vp.key, status: "fail", error: r.error });
      }
    }
  }

  await browser.close();

  console.log("\n[smoke] summary");
  console.table(results);
  const failed = results.filter((r) => r.status === "fail");
  if (failed.length > 0) {
    console.error(`[smoke] ${failed.length} failure(s)`);
    process.exit(1);
  }
  console.log("[smoke] all discovered formats passed");
}

main().catch((e) => {
  console.error("[smoke] fatal:", e);
  process.exit(1);
});
