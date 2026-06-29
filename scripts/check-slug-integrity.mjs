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
const row = psql(`
  SELECT seller_id::text || '|' || slug || '|' || category::text
  FROM public.marketplace_products
  WHERE status <> 'rejected'
  LIMIT 1;
`);
if (!row) {
  console.log("[slug-check] No non-rejected rows to probe; structural checks passed.");
  process.exit(0);
}
const [seller, slug, category] = row.split("|");

let stderr = "";
try {
  execFileSync(
    "psql",
    ["-At", "-v", "ON_ERROR_STOP=1", "-c",
      `BEGIN;
       INSERT INTO public.marketplace_products
         (seller_id, title, slug, status, price_cents, description, category)
       VALUES
         ('${seller}', 'slug-check duplicate probe', '${slug}', 'pending', 100, 'probe', '${category}');
       ROLLBACK;`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  fail("Duplicate (seller_id, slug) insert was NOT rejected by the unique index");
} catch (e) {
  stderr = (e.stderr || "").toString();
  if (!/duplicate key value|unique constraint|23505/i.test(stderr)) {
    fail(`Duplicate insert failed for an unexpected reason:\n${stderr}`);
  }
}

console.log("[slug-check] OK — slugs backfilled, unique index enforced, duplicate insert rejected.");
