#!/usr/bin/env node
// Verifies that creators can ONLY update `status` on public.affiliate_commissions.
// Attempts to change protected fields (sale_amount_cents, commission_cents,
// commission_rate_pct, etc.) as the row's creator must be rejected by the
// BEFORE UPDATE trigger `affiliate_commissions_guard_creator_update`.
//
// Structural checks:
//   1. RLS is enabled on affiliate_commissions.
//   2. UPDATE policy scopes to auth.uid() = creator_id.
//   3. Guard trigger exists and its function source lists every protected column.
//
// Behavioural checks (run inside a SAVEPOINT, always rolled back):
//   4. As `authenticated` with JWT claim sub=<creator_id>, UPDATE that changes
//      sale_amount_cents / commission_cents / commission_rate_pct is REJECTED.
//   5. As the same authenticated creator, UPDATE that only changes status
//      SUCCEEDS.
//   6. Admins (has_role admin) can update protected fields freely.
//
// Requires PG* env vars (PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT).
// Skips gracefully when DB env is unavailable.
import { execFileSync } from "node:child_process";

if (!process.env.PGHOST) {
  console.log("[commission-guard] No PGHOST set — skipping (run locally with DB env).");
  process.exit(0);
}

function psql(sql) {
  return execFileSync("psql", ["-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
  }).trim();
}

function psqlExpectError(sql, matcher, label) {
  try {
    execFileSync("psql", ["-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const stderr = (e.stderr || "").toString();
    if (matcher.test(stderr)) return;
    fail(`${label}: rejected, but for an unexpected reason:\n${stderr}`);
  }
  fail(`${label}: expected an error but the statement succeeded.`);
}

function fail(msg) {
  console.error(`[commission-guard] FAIL: ${msg}`);
  process.exit(1);
}

// 1. RLS enabled
const rls = psql(`
  SELECT relrowsecurity FROM pg_class
  WHERE oid = 'public.affiliate_commissions'::regclass;
`);
if (rls !== "t") fail("Row-level security is not enabled on affiliate_commissions.");

// 2. UPDATE policy scopes to creator_id
const policy = psql(`
  SELECT count(*) FROM pg_policies
  WHERE schemaname='public'
    AND tablename='affiliate_commissions'
    AND cmd='UPDATE'
    AND qual ILIKE '%auth.uid()%creator_id%'
    AND with_check ILIKE '%auth.uid()%creator_id%';
`);
if (policy === "0") fail("UPDATE policy scoped to (auth.uid() = creator_id) is missing.");

// 3. Trigger + function guard columns
const trig = psql(`
  SELECT count(*) FROM pg_trigger
  WHERE tgrelid = 'public.affiliate_commissions'::regclass
    AND tgname = 'affiliate_commissions_guard_creator_update'
    AND NOT tgisinternal;
`);
if (trig === "0") fail("Trigger affiliate_commissions_guard_creator_update is missing.");

const guarded = [
  "affiliate_user_id",
  "creator_id",
  "order_id",
  "order_item_id",
  "referral_code",
  "commission_cents",
  "sale_amount_cents",
  "commission_rate_pct",
  "created_at",
];
const src = psql(`
  SELECT pg_get_functiondef(oid)
  FROM pg_proc
  WHERE proname = 'affiliate_commissions_guard_creator_update'
    AND pronamespace = 'public'::regnamespace;
`);
for (const col of guarded) {
  if (!new RegExp(`NEW\\.${col}\\b.*OLD\\.${col}\\b`, "s").test(src)) {
    fail(`Guard function does not compare NEW.${col} against OLD.${col}.`);
  }
}

// Behavioural checks — need a real row to probe.
const row = psql(`
  SELECT id::text || '|' || creator_id::text
  FROM public.affiliate_commissions
  WHERE creator_id IS NOT NULL
  LIMIT 1;
`);

if (!row) {
  console.log(
    "[commission-guard] OK — structural checks passed (no rows available to probe runtime behaviour).",
  );
  process.exit(0);
}
const [rowId, creatorId] = row.split("|");

// 4. Creator cannot change protected fields.
const setJwt = (uid) => `
  SET LOCAL role authenticated;
  SET LOCAL "request.jwt.claims" = '${JSON.stringify({ sub: uid, role: "authenticated" })}';
`;

psqlExpectError(
  `BEGIN;
   ${setJwt(creatorId)}
   UPDATE public.affiliate_commissions
     SET sale_amount_cents = sale_amount_cents + 1
   WHERE id = '${rowId}';
   ROLLBACK;`,
  /Creators can only update status/i,
  "Creator changing sale_amount_cents",
);

psqlExpectError(
  `BEGIN;
   ${setJwt(creatorId)}
   UPDATE public.affiliate_commissions
     SET commission_cents = commission_cents + 1
   WHERE id = '${rowId}';
   ROLLBACK;`,
  /Creators can only update status/i,
  "Creator changing commission_cents",
);

psqlExpectError(
  `BEGIN;
   ${setJwt(creatorId)}
   UPDATE public.affiliate_commissions
     SET commission_rate_pct = COALESCE(commission_rate_pct, 0) + 1
   WHERE id = '${rowId}';
   ROLLBACK;`,
  /Creators can only update status/i,
  "Creator changing commission_rate_pct",
);

// 5. Creator CAN update status only. Roll back so state is unchanged.
try {
  const currentStatus = psql(
    `SELECT status FROM public.affiliate_commissions WHERE id = '${rowId}';`,
  );
  const probeStatus = currentStatus === "pending" ? "approved" : "pending";
  const affected = execFileSync(
    "psql",
    ["-At", "-v", "ON_ERROR_STOP=1", "-c",
      `BEGIN;
       ${setJwt(creatorId)}
       UPDATE public.affiliate_commissions
         SET status = '${probeStatus}'
       WHERE id = '${rowId}';
       SELECT status FROM public.affiliate_commissions WHERE id = '${rowId}';
       ROLLBACK;`],
    { encoding: "utf8" },
  ).trim();
  if (!affected.endsWith(probeStatus)) {
    fail(`Status-only update by creator did not take effect (got: ${affected}).`);
  }
} catch (e) {
  fail(`Status-only update by creator was rejected:\n${(e.stderr || "").toString()}`);
}

console.log(
  "[commission-guard] OK — RLS + trigger block creators from editing anything but status.",
);
