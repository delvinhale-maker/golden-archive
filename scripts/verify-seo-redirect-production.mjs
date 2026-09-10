#!/usr/bin/env node

const argv = process.argv.slice(2);

function help() {
  console.log(`AurumVault redirect-foundation production verifier

Required:
  --base-url <url>
  --product-uuid <uuid>
  --canonical-slug <slug>

Optional:
  --old-slug <slug>
  --timeout-ms <number>   default 15000

Checks:
  - canonical product returns 200
  - UUID URL returns exactly one 301 to canonical URL
  - optional historical slug returns exactly one 301 to canonical URL
  - each redirect destination returns 200 with no second redirect

This verifier performs read-only HTTP GET requests only.`);
}

if (argv.includes("--help") || argv.includes("-h")) {
  help();
  process.exit(0);
}

function arg(name) {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const value = argv[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

const rawBase = arg("--base-url") ?? process.env.SEO_VERIFY_BASE_URL;
const productUuid = arg("--product-uuid") ?? process.env.SEO_VERIFY_PRODUCT_UUID;
const canonicalSlug = arg("--canonical-slug") ?? process.env.SEO_VERIFY_CANONICAL_SLUG;
const oldSlug = arg("--old-slug") ?? process.env.SEO_VERIFY_OLD_SLUG;
const timeoutMs = Number(arg("--timeout-ms") ?? process.env.SEO_VERIFY_TIMEOUT_MS ?? "15000");

if (!rawBase || !productUuid || !canonicalSlug) {
  help();
  console.error("\nERROR: --base-url, --product-uuid and --canonical-slug are required.");
  process.exit(2);
}
if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
  throw new Error("--timeout-ms must be between 1000 and 120000");
}

const base = new URL(rawBase);
if (!/^https?:$/.test(base.protocol)) throw new Error("--base-url must use http or https");
base.pathname = base.pathname.replace(/\/$/, "");
base.search = "";
base.hash = "";
const origin = base.href.replace(/\/$/, "");

let failures = 0;
let checks = 0;
function record(name, ok, detail) {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function get(pathOrUrl, redirect = "manual") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(new URL(pathOrUrl, `${origin}/`), {
      method: "GET",
      redirect,
      signal: controller.signal,
      headers: {
        "user-agent": "AurumVault-Redirect-Foundation-Verifier/1.0",
        accept: "text/html,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timer);
  }
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

async function expectOneHop301(name, fromPath, canonicalPath) {
  const first = await get(fromPath, "manual");
  const location = first.headers.get("location");
  const expected = new URL(canonicalPath, `${origin}/`).href;
  const firstOk = first.status === 301 && !!location && sameUrl(location, expected);
  record(`${name}: 301`, firstOk, `HTTP ${first.status}; location=${location ?? "<missing>"}`);
  if (!firstOk) return;

  const destination = await get(location, "manual");
  record(`${name}: one-hop destination`, destination.status === 200, `HTTP ${destination.status}`);
}

async function main() {
  const canonicalPath = `/products/${encodeURIComponent(canonicalSlug)}`;
  const canonical = await get(canonicalPath, "manual");
  record("canonical product", canonical.status === 200, `HTTP ${canonical.status}`);

  await expectOneHop301(
    "UUID product URL",
    `/products/${encodeURIComponent(productUuid)}`,
    canonicalPath,
  );

  if (oldSlug) {
    await expectOneHop301(
      "historical product slug",
      `/products/${encodeURIComponent(oldSlug)}`,
      canonicalPath,
    );
  } else {
    console.log("SKIP historical product slug — no --old-slug supplied");
  }

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures) process.exit(1);
}

main().catch((error) => {
  console.error(`FAIL verifier runtime — ${error?.stack ?? error}`);
  process.exit(1);
});
