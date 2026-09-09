#!/usr/bin/env node

/**
 * Read-only HTTP verification for the 17 critical AurumVault product slug moves.
 * Performs GET requests only. It never writes application or database state.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const argv = process.argv.slice(2);

function help() {
  console.log(`AurumVault critical-slug HTTP verifier

Required:
  --base-url <url>                   Deployment origin to verify
  --social-planner-old-slug <slug>   Captured historical slug for the Social Media Planner

Optional:
  --plan <path>                      Plan JSON (default: scripts/seo/critical-slug-plan.json)
  --timeout-ms <number>              Per-request timeout (default: 15000)
  --help                             Show this help

Checks for all 17 critical products:
  - new canonical slug returns 200
  - UUID URL returns exactly one permanent 301 to the canonical slug
  - historical slug returns exactly one permanent 301 to the canonical slug
  - each redirect destination returns 200, preventing redirect chains

This verifier is read-only and performs HTTP GET requests only.`);
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
const dynamicOldSlug =
  arg("--social-planner-old-slug") ?? process.env.SEO_SOCIAL_PLANNER_OLD_SLUG;
const planPath = arg("--plan") ?? "scripts/seo/critical-slug-plan.json";
const timeoutMs = Number(arg("--timeout-ms") ?? process.env.SEO_VERIFY_TIMEOUT_MS ?? "15000");

if (!rawBaseUrl || !dynamicOldSlug) {
  help();
  console.error("\nERROR: --base-url and --social-planner-old-slug are required.");
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

const plan = JSON.parse(await readFile(resolve(planPath), "utf8"));
if (plan?.scope !== "critical-only" || plan?.expected_count !== 17) {
  throw new Error("Critical slug plan must be scope=critical-only with expected_count=17");
}
if (!Array.isArray(plan.products) || plan.products.length !== 17) {
  throw new Error("Critical slug plan must contain exactly 17 products");
}

let failures = 0;
let checks = 0;

function record(ok, label, detail) {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
}

function sameUrl(actual, expected) {
  try {
    const a = new URL(actual, `${origin}/`);
    const e = new URL(expected, `${origin}/`);
    a.hash = "";
    e.hash = "";
    return a.href === e.href;
  } catch {
    return false;
  }
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
        "user-agent": "AurumVault-Critical-Slug-Verifier/1.0",
        accept: "text/html,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function verifyRedirect(label, fromPath, canonicalPath) {
  const response = await get(fromPath, "manual");
  const location = response.headers.get("location");
  const expected = new URL(canonicalPath, `${origin}/`).href;
  const redirectOk = response.status === 301 && !!location && sameUrl(location, expected);
  record(
    redirectOk,
    `${label} permanent redirect`,
    `HTTP ${response.status}; location=${location ?? "<missing>"}`,
  );
  if (!redirectOk) return;

  const destination = await get(location, "manual");
  record(
    destination.status === 200,
    `${label} one-hop destination`,
    `HTTP ${destination.status}`,
  );
}

console.log(`Verifying 17 critical product slug moves at ${origin}`);

for (const product of plan.products) {
  const oldSlug = product.capture_current_slug ? dynamicOldSlug : product.old_slug;
  if (!oldSlug) throw new Error(`Missing historical slug for ${product.product_id}`);

  const canonicalPath = `/products/${encodeURIComponent(product.new_slug)}`;
  const canonical = await get(canonicalPath, "manual");
  record(
    canonical.status === 200,
    `${product.title}: canonical`,
    `HTTP ${canonical.status}; ${canonicalPath}`,
  );

  await verifyRedirect(
    `${product.title}: UUID`,
    `/products/${encodeURIComponent(product.product_id)}`,
    canonicalPath,
  );

  await verifyRedirect(
    `${product.title}: historical slug`,
    `/products/${encodeURIComponent(oldSlug)}`,
    canonicalPath,
  );
}

console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures) {
  console.error(`${failures} critical-slug HTTP verification check(s) failed.`);
  process.exit(1);
}
