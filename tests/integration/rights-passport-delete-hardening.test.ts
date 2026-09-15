/**
 * AurumVault Digital Rights Passport Generator — targeted RLS delete-policy
 * hardening (staging: Supabase ref ypelutaddlibqvpaekyq).
 *
 * Source-level verification of
 * docs/proposed-migrations/20260907120000_rights_passport_delete_hardening.sql.
 * The migration itself was written and reasoned about against the live
 * staging database (policies and grants read directly via the Supabase
 * MCP tools before this file was written), but this test file — like every
 * other tests/integration/rights-passport-*.test.ts file — verifies the
 * migration SQL's *text* content, not a live database. It cannot prove the
 * migration applies cleanly against staging; only an actual apply (a
 * separate, explicitly authorized step) proves that.
 *
 * Run: bun test tests/integration/rights-passport-delete-hardening.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const migration = read(
  "docs/proposed-migrations/20260907120000_rights_passport_delete_hardening.sql",
);
const priorFoundationMigration = read(
  "docs/proposed-migrations/20260829213658_create_rights_passport.sql",
);
const priorPublishingMigration = read(
  "docs/proposed-migrations/20260830150000_rights_passport_publishing.sql",
);

const OWNER_ADMIN_PREDICATE = "owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')";

// Strips SQL line comments so "does X appear anywhere" checks test actual
// statements, not this file's own explanatory prose (which legitimately
// names things like rights_passport_public_identities and REVOKE while
// explaining why they're untouched/unneeded).
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

const migrationCode = stripSqlComments(migration);

describe("delete-hardening migration — additive only, staged (not auto-applied)", () => {
  it("lives under docs/proposed-migrations, not supabase/migrations, so it is not auto-applied", () => {
    expect(migration.length).toBeGreaterThan(0);
  });

  it("never drops a table, truncates, deletes rows, or destructively alters anything", () => {
    expect(migrationCode).not.toMatch(/DROP TABLE/i);
    expect(migrationCode).not.toMatch(/^\s*TRUNCATE TABLE/im);
    expect(migrationCode).not.toMatch(/DELETE FROM/i);
    expect(migrationCode).not.toMatch(/^ALTER TABLE/im);
    expect(migrationCode).not.toMatch(/DROP COLUMN/i);
  });

  it("touches only rights_passports and rights_passport_snapshots policies", () => {
    expect(migrationCode).toMatch(/ON public\.rights_passports\b/);
    expect(migrationCode).toMatch(/ON public\.rights_passport_snapshots\b/);
    expect(migrationCode).not.toMatch(/rights_passport_public_identities/);
  });
});

describe("rights_passports — ALL policy replaced with explicit INSERT + UPDATE", () => {
  it("drops the old broad ALL policy", () => {
    expect(migration).toMatch(
      /DROP POLICY IF EXISTS "rights_passports_owner_write" ON public\.rights_passports/,
    );
  });

  it("creates an explicit INSERT policy with the preserved owner/admin predicate", () => {
    expect(migration).toMatch(
      /CREATE POLICY "rights_passports_owner_insert" ON public\.rights_passports[\s\S]{0,120}FOR INSERT TO authenticated/,
    );
    const insertBlockMatch = migration.match(
      /CREATE POLICY "rights_passports_owner_insert"[\s\S]*?;/,
    );
    expect(insertBlockMatch).not.toBeNull();
    expect(insertBlockMatch![0]).toContain(OWNER_ADMIN_PREDICATE);
  });

  it("creates an explicit UPDATE policy with the preserved owner/admin predicate on both USING and WITH CHECK", () => {
    const updateBlockMatch = migration.match(
      /CREATE POLICY "rights_passports_owner_update"[\s\S]*?;/,
    );
    expect(updateBlockMatch).not.toBeNull();
    const block = updateBlockMatch![0];
    expect(block).toMatch(/FOR UPDATE TO authenticated/);
    expect(block).toContain(`USING (${OWNER_ADMIN_PREDICATE})`);
    expect(block).toContain(`WITH CHECK (${OWNER_ADMIN_PREDICATE})`);
  });

  it("creates no DELETE policy for rights_passports", () => {
    const afterDrop = migration.slice(migration.indexOf('"rights_passports_owner_write"'));
    const rightsPassportsSection = afterDrop.slice(
      0,
      afterDrop.indexOf("rights_passport_snapshots"),
    );
    expect(rightsPassportsSection).not.toMatch(/FOR DELETE/i);
  });

  it("the preserved predicate matches the original migration's rights_passports_owner_write exactly", () => {
    const originalMatch = priorFoundationMigration.match(
      /CREATE POLICY "rights_passports_owner_write"[\s\S]*?;/,
    );
    expect(originalMatch).not.toBeNull();
    expect(originalMatch![0]).toContain(OWNER_ADMIN_PREDICATE);
  });
});

describe("rights_passport_snapshots — ALL policy replaced with explicit INSERT + UPDATE", () => {
  it("drops the old broad ALL policy", () => {
    expect(migration).toMatch(
      /DROP POLICY IF EXISTS "rights_passport_snapshots_owner_write" ON public\.rights_passport_snapshots/,
    );
  });

  it("creates an explicit INSERT policy with the preserved owner/admin predicate", () => {
    const insertBlockMatch = migration.match(
      /CREATE POLICY "rights_passport_snapshots_owner_insert"[\s\S]*?;/,
    );
    expect(insertBlockMatch).not.toBeNull();
    const block = insertBlockMatch![0];
    expect(block).toMatch(/FOR INSERT TO authenticated/);
    expect(block).toContain(OWNER_ADMIN_PREDICATE);
  });

  it("creates an explicit UPDATE policy with the preserved owner/admin predicate on both USING and WITH CHECK", () => {
    const updateBlockMatch = migration.match(
      /CREATE POLICY "rights_passport_snapshots_owner_update"[\s\S]*?;/,
    );
    expect(updateBlockMatch).not.toBeNull();
    const block = updateBlockMatch![0];
    expect(block).toMatch(/FOR UPDATE TO authenticated/);
    expect(block).toContain(`USING (${OWNER_ADMIN_PREDICATE})`);
    expect(block).toContain(`WITH CHECK (${OWNER_ADMIN_PREDICATE})`);
  });

  it("creates no DELETE policy for rights_passport_snapshots", () => {
    const afterDrop = migration.slice(migration.indexOf('"rights_passport_snapshots_owner_write"'));
    expect(afterDrop).not.toMatch(/FOR DELETE/i);
  });

  it("the preserved predicate matches the original migration's rights_passport_snapshots_owner_write exactly", () => {
    const originalMatch = priorPublishingMigration.match(
      /CREATE POLICY "rights_passport_snapshots_owner_write"[\s\S]*?;/,
    );
    expect(originalMatch).not.toBeNull();
    expect(originalMatch![0]).toContain(OWNER_ADMIN_PREDICATE);
  });

  it("does not touch the immutability guard trigger or the one-ACTIVE-snapshot unique index", () => {
    expect(migrationCode).not.toMatch(/rights_passport_snapshots_guard_immutable/);
    expect(migrationCode).not.toMatch(/rights_passport_snapshots_one_active_per_key/);
  });
});

describe("no REVOKE statements — DELETE privilege was verified absent, not assumed", () => {
  it("adds no REVOKE statement of any kind", () => {
    expect(migrationCode).not.toMatch(/REVOKE/i);
  });
});

describe("SELECT policies and unrelated tables are untouched", () => {
  it("does not drop or recreate any *_owner_read policy", () => {
    expect(migration).not.toMatch(/rights_passports_owner_read/);
    expect(migration).not.toMatch(/rights_passport_snapshots_owner_read/);
  });

  it("does not reference any other Rights Passport table", () => {
    const unrelatedTables = [
      "rights_passport_assets",
      "rights_ai_consents",
      "rights_licenses",
      "rights_evidence",
      "rights_review_flags",
      "rights_passport_documents",
      "rights_analysis_runs",
      "rights_analysis_findings",
      "rights_passport_entitlements",
      "rights_passport_events",
    ];
    for (const table of unrelatedTables) {
      expect(migrationCode).not.toContain(table);
    }
  });
});
