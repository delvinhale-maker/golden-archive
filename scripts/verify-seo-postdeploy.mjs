#!/usr/bin/env node

/**
 * AurumVault post-deploy SEO verification.
 *
 * This script is intentionally read-only. It performs HTTP GET requests only
 * and never writes database/application state.
 *
 * Example:
 *   node scripts/verify-seo-postdeploy.mjs \
 *     --base-url https://staging.example.com \
 *     --product-uuid 22945d35-29d7-4286-9362-5e348d47f938 \
 *     --canonical-slug digital-rights-passport \
 *     --old-slug digital
 */

const argv = process.argv.slice(2);

function help() {
  console.log(`AurumVault post-deploy SEO verifier

Required:
  --base-url <url>          Deployment origin to verify
  --product-uuid <uuid>     Published product UUID that should redirect
  --canonical-slug <slug>   Current published canonical product slug

Optional:
  --old-slug <slug>         Historical slug seeded in product_slug_redirects
  --timeout-ms <number>     Per-request timeout (default: 15000)
  --help                    Show this help

Checks:
  - canonical product returns 200
  - UUID URL returns exactly one 301 to canonical product URL
  - optional historical slug returns exactly one 301 to canonical product URL
  - clean category/acquisition routes return 200
  - filtered /products page is server-rendered noindex,follow with /ebooks canonical
  - sitemap is valid enough for release gating, contains image namespace and new routes

The verifier is read-only and performs GET requests only.`);
}

if (argv.includes("--help") || argv.includes("-h")) {
  help();
  process.exit(0);
}

function arg(name) {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  const value = argv[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

const rawBaseUrl = arg("--base-url") ?? process.env.SEO_VERIFY_BASE_URL;
const productUuid = arg("--product-uuid") ?? process.env.SEO_VERIFY_PRODUCT_UUID;
const canonicalSlug = arg("--canonical-slug") ?? process.env.SEO_VERIFY_CANONICAL_SLUG;
const oldSlug = arg("--old-slug") ?? process.env.SEO_VERIFY_OLD_SLUG;
const timeoutMs = Number(arg("--timeout-ms") ?? process.env.SEO_VERIFY_TIMEOUT_MS ?? "15000");

if (!rawBaseUrl || !productUuid || !canonicalSlug) {
  help();
  console.error("\nERROR: --base-url, --product-uuid and --canonical-slug are required.");
  process.exit(2);
}
if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
  throw new Error("--timeout-ms must be between 1000 and 120000");
}

const baseUrl = new URL(rawBaseUrl);
if (!/^https?:$/.test(baseUrl.protocol)) throw new Error("--base-url must use http or https");
baseUrl.pathname = baseUrl.pathname.replace(/\/$/, "");
baseUrl.search = "";
baseUrl.hash = "";
const origin = baseUrl.href.replace(/\/$/, "");

const results = [];
let failures = 0;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function sameUrl(actual, expected) {
  try {
    const a = new URL(actual, origin);
    const e = new URL(expected, origin);
    a.hash = "";
    e.hash = "";
    return a.href === e.href;
  } catch {
    return false;
  }
}

async function get(pathOrUrl, { redirect = "follow" } = {}) {
  const url = new URL(pathOrUrl, `${origin}/`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      redirect,
      signal: controller.signal,
      headers: {
        "user-agent": "AurumVault-SEO-PostDeploy-Verifier/1.0",
        accept: "text/html,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function attributes(tag) {
  const out = new Map();
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) {
    out.set(match[1].toLowerCase(), match[2]);
  }
  return out;
}

function findMeta(html, name) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if ((attrs.get("name") ?? "").toLowerCase() === name.toLowerCase()) {
      return attrs.get("content") ?? "";
    }
  }
  return undefined;
}

function findCanonical(html) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if ((attrs.get("rel") ?? "").toLowerCase().split(/\s+/).includes("canonical")) {
      return attrs.get("href");
    }
  }
  return undefined;
}

async function expect200(name, path) {
  const response = await get(path);
  record(name, response.status === 200, `HTTP ${response.status}`);
  return response;
}

async function expectSingle301(name, fromPath, expectedPath) {
  const first = await get(fromPath, { redirect: "manual" });
  const location = first.headers.get("location");
  const expected = new URL(expectedPath, `${origin}/`).href;
  const firstOk = first.status === 301 && !!location && sameUrl(location, expected);
  record(
    `${name}: permanent redirect`,
    firstOk,
    `HTTP ${first.status}; location=${location ?? "<missing>"}`,
  );
  if (!firstOk) return;

  const second = await get(location, { redirect: "manual" });
  record(`${name}: no redirect chain`, second.status === 200, `destination HTTP ${second.status}`);
}

async function main() {
  console.log(`Verifying ${origin}`);
  console.log(`Canonical product: /products/${canonicalSlug}`);

  const canonicalProductPath = `/products/${encodeURIComponent(canonicalSlug)}`;
  await expect200("canonical product", canonicalProductPath);
  await expectSingle301(
    "UUID product URL",
    `/products/${encodeURIComponent(productUuid)}`,
    canonicalProductPath,
  );

  if (oldSlug) {
    await expectSingle301(
      "historical product slug",
      `/products/${encodeURIComponent(oldSlug)}`,
      canonicalProductPath,
    );
  } else {
    console.log("SKIP historical product slug — no --old-slug supplied");
  }

  for (const route of [
    "/ebooks",
    "/journals",
    "/planners",
    "/ai-prompt-packs",
    "/tools/ai-likeness-rights-risk-checker",
  ]) {
    await expect200(`public route ${route}`, route);
  }

  const filtered = await get("/products?category=eBooks");
  const filteredHtml = await filtered.text();
  const robots = findMeta(filteredHtml, "robots");
  const canonical = findCanonical(filteredHtml);
  record("filtered products page responds", filtered.status === 200, `HTTP ${filtered.status}`);
  record(
    "filtered products robots",
    !!robots && /(^|\s|,)noindex(\s|,|$)/i.test(robots) && /(^|\s|,)follow(\s|,|$)/i.test(robots),
    `robots=${robots ?? "<missing>"}`,
  );
  record(
    "filtered products canonical",
    !!canonical && sameUrl(canonical, `${origin}/ebooks`),
    `canonical=${canonical ?? "<missing>"}`,
  );

  const sitemap = await get("/sitemap.xml");
  const sitemapText = await sitemap.text();
  record("sitemap responds", sitemap.status === 200, `HTTP ${sitemap.status}`);
  record(
    "sitemap image namespace",
    sitemapText.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'),
    "Google image namespace",
  );
  for (const route of [
    "/ebooks",
    "/journals",
    "/planners",
    "/ai-prompt-packs",
    "/tools/ai-likeness-rights-risk-checker",
    canonicalProductPath,
  ]) {
    const expected = `${origin}${route}`;
    record(`sitemap contains ${route}`, sitemapText.includes(expected), expected);
  }

  console.log(`\n${results.length - failures}/${results.length} checks passed.`);
  if (failures) {
    console.error(`${failures} post-deploy SEO verification check(s) failed.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`FAIL verifier runtime — ${error?.stack ?? error}`);
  process.exit(1);
});
