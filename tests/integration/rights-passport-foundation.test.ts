/**
 * AurumVault Digital Rights Passport Generator — foundation security/
 * regression guard.
 *
 * rights-passport*.functions.ts pull in zod/@supabase/supabase-js/
 * @tanstack/react-start, none of which are installed in this sandbox (the
 * same pre-existing, environment-wide constraint every other
 * tests/integration/*.test.ts file in this repo works around). This suite
 * is therefore source-level verification. rights-passport-readiness.test.ts
 * covers what genuinely can run (the pure scoring logic) with real, executed
 * assertions.
 *
 * Run: bun test tests/integration/rights-passport-foundation.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const passportFn = read("src/lib/rights-passport.functions.ts");
const assetFn = read("src/lib/rights-passport-assets.functions.ts");
const schema = read("src/lib/rights-passport.schema.ts");
const migration = read("docs/proposed-migrations/20260829213658_create_rights_passport.sql");

function bodyOf(source: string, exportName: string): string {
  const start = source.indexOf(`export const ${exportName}`);
  expect(start, `${exportName} should exist`).toBeGreaterThan(-1);
  const end = source.indexOf("\nexport const", start + 10);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("migration — additive only, staged (not auto-applied)", () => {
  it("lives under docs/proposed-migrations, not supabase/migrations, so it is not auto-applied", () => {
    // The file being read from this exact path IS the assertion — if it had
    // been placed under supabase/migrations/ instead, this read would fail.
    expect(migration.length).toBeGreaterThan(0);
  });

  it("never drops, truncates, or deletes existing data; never alters a pre-existing table", () => {
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).not.toMatch(/^\s*TRUNCATE TABLE/im);
    expect(migration).not.toMatch(/DELETE FROM/i);
    const alterLines = migration.match(/^ALTER TABLE public\.\w+/gim) ?? [];
    for (const line of alterLines) {
      expect(line).toMatch(/rights_passports|rights_passport_assets/);
    }
  });

  it("creates rights_passports and rights_passport_assets with RLS enabled and no anon grant", () => {
    for (const table of ["rights_passports", "rights_passport_assets"]) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL ON public.${table} FROM anon`);
    }
  });

  it("enforces at most one ACTIVE version per passport lineage via a partial unique index", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX rights_passports_one_active_per_key\s+ON public\.rights_passports \(passport_key\)\s+WHERE status = 'ACTIVE'/,
    );
  });

  it("guards owner_user_id and passport_key immutability on rights_passports", () => {
    expect(migration).toContain("rights_passports_guard_identity");
    expect(migration).toMatch(/NEW\.owner_user_id IS DISTINCT FROM OLD\.owner_user_id/);
    expect(migration).toMatch(/NEW\.passport_key IS DISTINCT FROM OLD\.passport_key/);
  });

  it("guards that an asset can only attach to a passport_key the same owner actually controls", () => {
    expect(migration).toContain("rights_passport_assets_guard_passport_owner");
    expect(migration).toMatch(/passport_owner IS DISTINCT FROM NEW\.owner_user_id/);
  });

  it("includes REVIEW_REQUIRED as a first-class control_basis and asset_status value — the safety rule enforced at the schema level", () => {
    expect(migration).toMatch(/rights_control_basis[\s\S]*?'REVIEW_REQUIRED'/);
    expect(migration).toMatch(/rights_asset_status AS ENUM[\s\S]*?'REVIEW_REQUIRED'/);
  });
});

describe("rights-passport.functions.ts — authenticated and owner-derived", () => {
  it("every function requires requireSupabaseAuth", () => {
    for (const name of [
      "createPassport",
      "updatePassport",
      "getPassport",
      "listMyPassportVersions",
      "createNewPassportVersion",
      "getPassportHome",
    ]) {
      expect(bodyOf(passportFn, name)).toMatch(
        /\.middleware\(\[(?:requireRightsPassport\w+,\s*)?requireSupabaseAuth\]\)/,
      );
    }
  });

  it("no function ever accepts an owner id from client input", () => {
    expect(passportFn).not.toMatch(/ownerUserId/);
    expect(passportFn).not.toMatch(/owner_user_id:\s*data\./);
  });

  it("createPassport derives owner_user_id from context, not from input", () => {
    const body = bodyOf(passportFn, "createPassport");
    expect(body).toContain("owner_user_id: userId");
  });

  it("updatePassport and getPassport scope every query by both id and owner_user_id", () => {
    for (const name of ["updatePassport", "getPassport"]) {
      const body = bodyOf(passportFn, name);
      expect(body).toMatch(/\.eq\(\s*"id"[^)]*\)/);
      expect(body).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    }
  });

  it("activating a version supersedes any other ACTIVE row in the same lineage before promoting the new one", () => {
    const body = bodyOf(passportFn, "updatePassport");
    const supersedeIdx = body.indexOf('.update({ status: "SUPERSEDED" })');
    const activateIdx = body.indexOf(".update(patch)");
    expect(supersedeIdx).toBeGreaterThan(-1);
    expect(activateIdx).toBeGreaterThan(supersedeIdx);
  });

  it("supersede-before-activate is scoped by passport_key, owner_user_id, status=ACTIVE, and excludes the row being activated", () => {
    const body = bodyOf(passportFn, "updatePassport");
    const supersedeBlock = body.slice(
      body.indexOf('.update({ status: "SUPERSEDED" })'),
      body.indexOf('.update({ status: "SUPERSEDED" })') + 300,
    );
    expect(supersedeBlock).toContain('.eq("passport_key", passportKey)');
    expect(supersedeBlock).toContain('.eq("owner_user_id", userId)');
    expect(supersedeBlock).toContain('.eq("status", "ACTIVE")');
    expect(supersedeBlock).toContain('.neq("id", id)');
  });

  it("createNewPassportVersion re-derives the source row scoped to the caller before cloning it", () => {
    const body = bodyOf(passportFn, "createNewPassportVersion");
    expect(body).toMatch(/\.eq\(\s*"id"[^)]*data\.id\s*\)/);
    expect(body).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    expect(body).toContain("passport_key: src.passport_key");
    expect(body).toContain("previous_version_id: src.id");
    expect(body).toContain('status: "DRAFT"');
  });

  it("createNewPassportVersion never inherits the source row's own id as its new id (previous_version_id referencing it is fine and expected)", () => {
    const body = bodyOf(passportFn, "createNewPassportVersion");
    expect(body).not.toMatch(/[{,]\s*id:\s*src\.id\b/);
    expect(body).toContain("previous_version_id: src.id");
  });

  it("getPassportHome scopes both the active-row and asset lookups by the authenticated user / passport_key", () => {
    const body = bodyOf(passportFn, "getPassportHome");
    expect(body).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    expect(body).toContain('.eq("passport_key" as never, passport.passport_key)');
  });

  it("getPassportHome never fabricates a legal ownership claim — no field named ownershipConfirmed/legallyOwns anywhere", () => {
    expect(passportFn).not.toMatch(/ownershipConfirmed|legallyOwns|isOwner\b/);
  });
});

describe("rights-passport-assets.functions.ts — owner-scoped, passport-bound", () => {
  it("every function requires requireSupabaseAuth", () => {
    for (const name of ["createAsset", "updateAsset", "listAssets", "archiveAsset"]) {
      expect(bodyOf(assetFn, name)).toMatch(
        /\.middleware\(\[(?:requireRightsPassport\w+,\s*)?requireSupabaseAuth\]\)/,
      );
    }
  });

  it("createAsset verifies passport ownership before inserting", () => {
    const body = bodyOf(assetFn, "createAsset");
    expect(body).toContain("assertOwnsPassportKey(supabase, userId, passportKey)");
  });

  it("assertOwnsPassportKey scopes its lookup by both passport_key and owner_user_id", () => {
    const helper = assetFn.slice(
      assetFn.indexOf("async function assertOwnsPassportKey"),
      assetFn.indexOf("async function assertOwnsPassportKey") + 600,
    );
    expect(helper).toMatch(/\.eq\(\s*"passport_key"[^)]*passportKey\s*\)/);
    expect(helper).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
  });

  it("updateAsset, listAssets, and archiveAsset all scope by owner_user_id", () => {
    for (const name of ["updateAsset", "listAssets", "archiveAsset"]) {
      const body = bodyOf(assetFn, name);
      expect(body).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    }
  });

  it("archiveAsset only ever sets status to ARCHIVED — no hard delete anywhere in this file", () => {
    expect(assetFn).not.toMatch(/\.delete\(\)/);
    expect(bodyOf(assetFn, "archiveAsset")).toContain('status: "ARCHIVED"');
  });
});

describe("rights-passport.schema.ts — safety-rule enforcement in the type system", () => {
  it("exports the required product-safety disclaimer text verbatim", () => {
    expect(schema).toContain(
      "This tool is educational and organizational. It does not create a government registration, establish legal ownership, or replace legal advice.",
    );
  });

  it("REVIEW_REQUIRED is present in both control basis and AI policy enums", () => {
    expect(schema).toMatch(/CONTROL_BASES = \[[\s\S]*?"REVIEW_REQUIRED"/);
    expect(schema).toMatch(/AI_POLICIES = \[[\s\S]*?"REVIEW_REQUIRED"/);
  });

  it("verification levels never imply certification — no CERTIFIED/GOVERNMENT_VERIFIED value exists", () => {
    expect(schema).not.toMatch(/CERTIFIED|GOVERNMENT_VERIFIED|LEGALLY_VERIFIED/);
  });
});
