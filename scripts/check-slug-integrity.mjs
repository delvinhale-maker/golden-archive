#!/usr/bin/env node
// Verifies marketplace_products slug integrity:
//  1. No NULL / empty slugs.
//  2. Partial unique index on (seller_id, slug) WHERE status <> 'rejected' exists.
//  3. Inserting a duplicate (seller_id, slug) for a non-rejected row is rejected
//     by the database (rolled back).
//
// Requires PG* env vars (PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT).
// Skips gracefully when DB env is unavailable so CI without DB doesn't fail.
import { execFileSync } from "node:child_process";

if (!process.env.PGHOST) {
  console.log("[slug-check] No PGHOST set — skipping (run locally with DB env).");
  process.exit(0);
}

function psql(sql) {
  return execFileSync("psql", ["-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
  }).trim();
}

function fail(msg) {
  console.error(`[slug-check] FAIL: ${msg}`);
  process.exit(1);
}

// 1. No null/empty slugs
const missing = psql(
  "SELECT count(*) FROM public.marketplace_products WHERE slug IS NULL OR length(trim(slug)) = 0;"
);
if (missing !== "0") fail(`${missing} rows have NULL/empty slug`);

// 2. Partial unique index present
const idx = psql(`
  SELECT count(*) FROM pg_indexes
  WHERE schemaname='public'
    AND tablename='marketplace_products'
    AND indexdef ILIKE '%UNIQUE%'
    AND indexdef ILIKE '%(seller_id, slug)%'
    AND indexdef ILIKE '%status%rejected%';
`);
if (idx === "0") fail("Partial unique index on (seller_id, slug) WHERE status <> 'rejected' is missing");

// 3. Duplicate insert must fail (rolled back via SAVEPOINT)
const seller = psql(
  "SELECT seller_id::text FROM public.marketplace_products WHERE status <> 'rejected' LIMIT 1;"
);
const slug = psql(
  `SELECT slug FROM public.marketplace_products WHERE seller_id='${seller}' AND status <> 'rejected' LIMIT 1;`
);
if (!seller || !slug) {
  console.log("[slug-check] No non-rejected rows to test duplicate insert; structural checks passed.");
  process.exit(0);
}

let duplicateRejected = false;
try {
  psql(`
    BEGIN;
    SAVEPOINT sp;
    INSERT INTO public.marketplace_products
      (seller_id, title, slug, status, price_cents, currency)
    VALUES
      ('${seller}', 'slug-check duplicate probe', '${slug}', 'pending', 100, 'usd');
    ROLLBACK;
  `);
} catch {
  duplicateRejected = true;
}
if (!duplicateRejected) fail("Duplicate (seller_id, slug) insert was NOT rejected by the unique index");

console.log("[slug-check] OK — slugs backfilled, unique index enforced, duplicate insert rejected.");
