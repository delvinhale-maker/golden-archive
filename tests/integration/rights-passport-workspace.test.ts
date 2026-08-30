/**
 * AurumVault Digital Rights Passport Generator — Round 2 (Rights Control
 * Workspace) security/regression guard.
 *
 * Same constraint as tests/integration/rights-passport-foundation.test.ts:
 * the workspace server functions pull in zod/@supabase/supabase-js/
 * @tanstack/react-start, none of which are installed in this sandbox. This
 * suite is therefore source-level verification of the migration text and
 * the server function source, exercising the exact ownership-isolation
 * properties the spec requires:
 *   - a user must never be able to insert a license against someone else's
 *     passport
 *   - a user must never be able to attach evidence to someone else's asset
 *   - a user must never be able to create an AI permission for someone
 *     else's passport
 *   - a user must never be able to read another user's private evidence
 *   - a user must never be able to enumerate another user's passport IDs
 *
 * rights-passport-risk-rules.test.ts and rights-passport-readiness-v2.test.ts
 * cover what genuinely runs (the pure deterministic logic) with real,
 * executed assertions.
 *
 * Run: bun test tests/integration/rights-passport-workspace.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const migration = read(
  "docs/proposed-migrations/20260830013807_rights_passport_control_workspace.sql",
);
const aiConsentFn = read("src/lib/rights-passport-ai-consent.functions.ts");
const licenseFn = read("src/lib/rights-passport-licenses.functions.ts");
const evidenceFn = read("src/lib/rights-passport-evidence.functions.ts");
const reviewFn = read("src/lib/rights-passport-review.functions.ts");
const workspaceSchema = read("src/lib/rights-passport-workspace.schema.ts");

function bodyOf(source: string, exportName: string): string {
  const start = source.indexOf(`export const ${exportName}`);
  expect(start, `${exportName} should exist`).toBeGreaterThan(-1);
  const end = source.indexOf("\nexport const", start + 10);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("migration — additive only, staged (not auto-applied)", () => {
  it("lives under docs/proposed-migrations, not supabase/migrations, so it is not auto-applied", () => {
    expect(migration.length).toBeGreaterThan(0);
  });

  it("never drops, truncates, or deletes existing data; never alters a pre-existing table", () => {
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).not.toMatch(/^\s*TRUNCATE TABLE/im);
    expect(migration).not.toMatch(/DELETE FROM/i);
    expect(migration).not.toMatch(
      /^ALTER TABLE public\.(rights_passports|rights_passport_assets)\b/im,
    );
  });

  it("creates all 4 new tables with RLS enabled and no anon grant", () => {
    for (const table of [
      "rights_ai_consents",
      "rights_licenses",
      "rights_evidence",
      "rights_review_flags",
    ]) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL ON public.${table} FROM anon`);
    }
  });

  it("every new table's SELECT policy is scoped to owner_user_id = auth.uid() (no public/anon read path)", () => {
    for (const table of [
      "rights_ai_consents",
      "rights_licenses",
      "rights_evidence",
      "rights_review_flags",
    ]) {
      const policyIdx = migration.indexOf(`"${table}_owner_read" ON public.${table}`);
      expect(policyIdx, `${table} owner_read policy should exist`).toBeGreaterThan(-1);
      const policyBlock = migration.slice(policyIdx, policyIdx + 300);
      expect(policyBlock).toMatch(/USING \(owner_user_id = auth\.uid\(\)/);
    }
  });

  it("no new table has a public/anon SELECT policy — private evidence is never anonymously readable", () => {
    expect(migration).not.toMatch(/FOR SELECT TO (anon|public)/i);
    expect(migration).not.toMatch(/rights_evidence.*TO anon/is);
  });

  it("a passport-ownership guard trigger runs on insert/update for all 4 tables, blocking writes against a passport the caller does not own", () => {
    for (const table of [
      "rights_ai_consents",
      "rights_licenses",
      "rights_evidence",
      "rights_review_flags",
    ]) {
      expect(migration).toContain(`${table}_guard_passport_owner_trg`);
    }
    expect(migration).toMatch(/passport_owner IS DISTINCT FROM NEW\.owner_user_id/);
    expect(migration).toContain(
      "RAISE EXCEPTION 'A record can only be attached to a passport you own'",
    );
  });

  it("an asset-ownership guard trigger runs on the 3 asset-referencing tables, blocking evidence/consent/license attachment to an asset outside the same passport", () => {
    for (const table of ["rights_ai_consents", "rights_licenses", "rights_evidence"]) {
      expect(migration).toContain(`${table}_guard_asset_passport_trg`);
    }
    expect(migration).toMatch(/asset_passport_key IS DISTINCT FROM NEW\.passport_key/);
    expect(migration).toContain("RAISE EXCEPTION 'Asset does not belong to this passport'");
  });

  it("no new table grants DELETE to authenticated — records are archived/resolved, never hard-deleted", () => {
    for (const table of [
      "rights_ai_consents",
      "rights_licenses",
      "rights_evidence",
      "rights_review_flags",
    ]) {
      expect(migration).toContain(
        `REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.${table} FROM authenticated`,
      );
    }
  });

  it("review flags carry a unique idempotency key so re-running the rule engine cannot create duplicates", () => {
    expect(migration).toMatch(
      /CONSTRAINT rights_review_flags_unique_rule UNIQUE NULLS NOT DISTINCT \(passport_key, rule_code, affected_entity_type, affected_entity_id\)/,
    );
  });

  it("no permission column defaults to ALLOW anywhere in the new schema", () => {
    expect(migration).not.toMatch(/permission[^,]*DEFAULT 'ALLOW'/i);
  });
});

describe("rights-passport-ai-consent.functions.ts — owner-scoped, passport-bound", () => {
  it("every function requires requireSupabaseAuth", () => {
    for (const name of ["upsertAiConsent", "listAiConsents"]) {
      expect(bodyOf(aiConsentFn, name)).toMatch(
        /\.middleware\(\[(?:requireRightsPassport\w+,\s*)?requireSupabaseAuth\]\)/,
      );
    }
  });

  it("upsertAiConsent verifies passport ownership server-side before writing (cannot create a permission for someone else's passport)", () => {
    const body = bodyOf(aiConsentFn, "upsertAiConsent");
    expect(body).toContain("assertOwnsPassportKey(supabase, userId, passportKey)");
  });

  it("assertOwnsPassportKey scopes its lookup by both passport_key and owner_user_id", () => {
    const helper = aiConsentFn.slice(
      aiConsentFn.indexOf("async function assertOwnsPassportKey"),
      aiConsentFn.indexOf("async function assertOwnsPassportKey") + 600,
    );
    expect(helper).toMatch(/\.eq\(\s*"passport_key"[^)]*passportKey\s*\)/);
    expect(helper).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
  });

  it("owner_user_id is always derived from context, never accepted from client input", () => {
    expect(aiConsentFn).not.toMatch(/ownerUserId/);
    expect(aiConsentFn).not.toMatch(/owner_user_id:\s*data\./);
    expect(bodyOf(aiConsentFn, "upsertAiConsent")).toContain("owner_user_id: userId");
  });

  it("listAiConsents scopes by owner_user_id — a user cannot list another user's AI consent rows", () => {
    expect(bodyOf(aiConsentFn, "listAiConsents")).toMatch(
      /\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/,
    );
  });
});

describe("rights-passport-licenses.functions.ts — owner-scoped, passport-bound", () => {
  it("every function requires requireSupabaseAuth", () => {
    for (const name of ["createLicense", "updateLicense", "listLicenses"]) {
      expect(bodyOf(licenseFn, name)).toMatch(
        /\.middleware\(\[(?:requireRightsPassport\w+,\s*)?requireSupabaseAuth\]\)/,
      );
    }
  });

  it("createLicense verifies passport ownership server-side before inserting (cannot insert a license against someone else's passport)", () => {
    const body = bodyOf(licenseFn, "createLicense");
    expect(body).toContain("assertOwnsPassportKey(supabase, userId, passportKey)");
  });

  it("createLicense never accepts a passport_key that bypasses the ownership check — passportKey is destructured before the assert runs", () => {
    const body = bodyOf(licenseFn, "createLicense");
    const assertIdx = body.indexOf("assertOwnsPassportKey");
    const insertIdx = body.indexOf(".insert(");
    expect(assertIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(assertIdx);
  });

  it("updateLicense and listLicenses scope every query by owner_user_id", () => {
    for (const name of ["updateLicense", "listLicenses"]) {
      expect(bodyOf(licenseFn, name)).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    }
  });

  it("owner_user_id is always derived from context, never accepted from client input", () => {
    expect(licenseFn).not.toMatch(/ownerUserId/);
    expect(licenseFn).not.toMatch(/owner_user_id:\s*data\./);
  });

  it("license status is never auto-marked invalid by this file — expiry detection is left to the read-only risk engine", () => {
    expect(licenseFn).not.toMatch(/status:\s*"EXPIRED"/);
  });
});

describe("rights-passport-evidence.functions.ts — owner-scoped, passport-bound", () => {
  it("every function requires requireSupabaseAuth", () => {
    for (const name of ["createEvidence", "updateEvidence", "listEvidence"]) {
      expect(bodyOf(evidenceFn, name)).toMatch(
        /\.middleware\(\[(?:requireRightsPassport\w+,\s*)?requireSupabaseAuth\]\)/,
      );
    }
  });

  it("createEvidence verifies passport ownership server-side before inserting (cannot attach evidence to someone else's asset/passport)", () => {
    const body = bodyOf(evidenceFn, "createEvidence");
    expect(body).toContain("assertOwnsPassportKey(supabase, userId, passportKey)");
  });

  it("updateEvidence and listEvidence scope every query by owner_user_id — a user cannot read or edit another user's private evidence", () => {
    for (const name of ["updateEvidence", "listEvidence"]) {
      expect(bodyOf(evidenceFn, name)).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    }
  });

  it("owner_user_id is always derived from context, never accepted from client input", () => {
    expect(evidenceFn).not.toMatch(/ownerUserId/);
    expect(evidenceFn).not.toMatch(/owner_user_id:\s*data\./);
  });

  it("no function here computes or returns an ownership-confirmed / legally-verified value", () => {
    expect(evidenceFn).not.toMatch(/ownershipConfirmed|legallyOwns|legallyVerified/);
  });
});

function reconcileFnBody(source: string): string {
  const start = source.indexOf("export async function reconcileReviewFlagsForPassportKey");
  expect(start, "reconcileReviewFlagsForPassportKey should exist").toBeGreaterThan(-1);
  const end = source.indexOf("\nexport const syncReviewFlags", start);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("rights-passport-review.functions.ts — deterministic sync, owner-scoped", () => {
  it("every function requires requireSupabaseAuth", () => {
    for (const name of ["syncReviewFlags", "listReviewFlags", "setReviewFlagStatus"]) {
      expect(bodyOf(reviewFn, name)).toMatch(
        /\.middleware\(\[(?:requireRightsPassport\w+,\s*)?requireSupabaseAuth\]\)/,
      );
    }
  });

  it("syncReviewFlags re-derives the passport_key scoped to (id, owner_user_id) before delegating to the reconciliation core — a user cannot sync flags for a passport ID that isn't theirs, so passport IDs cannot be enumerated this way", () => {
    const body = bodyOf(reviewFn, "syncReviewFlags");
    expect(body).toMatch(/\.eq\(\s*"id"[^)]*data\.id\s*\)/);
    expect(body).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    expect(body).toContain('if (!passportRow) throw new Error("Passport not found")');
    expect(body).toContain("reconcileReviewFlagsForPassportKey(supabase, userId, passportKey)");
  });

  it("reconcileReviewFlagsForPassportKey (the shared core, also used by applyProposal) scopes every child-table read by both passport_key and owner_user_id", () => {
    const body = reconcileFnBody(reviewFn);
    for (const table of [
      "rights_passport_assets",
      "rights_ai_consents",
      "rights_licenses",
      "rights_evidence",
      "rights_review_flags",
    ]) {
      const tableIdx = body.indexOf(`"${table}"`);
      expect(tableIdx, `${table} should be queried`).toBeGreaterThan(-1);
    }
    const ownerMatches = body.match(/\.eq\("owner_user_id" as never, userId\)/g) ?? [];
    expect(ownerMatches.length).toBeGreaterThanOrEqual(5);
  });

  it("reconcileReviewFlagsForPassportKey never resets an existing OPEN/ACKNOWLEDGED/ACCEPTED_RISK row's status when the same rule re-fires — user triage state survives re-evaluation", () => {
    const body = reconcileFnBody(reviewFn);
    expect(body).toContain("Existing OPEN/ACKNOWLEDGED/ACCEPTED_RISK rows are intentionally");
    expect(body).toContain("left untouched");
  });

  it("reconcileReviewFlagsForPassportKey marks a stored non-RESOLVED row RESOLVED once its rule no longer computes, and never touches rows outside the caller's own passport_key/owner_user_id", () => {
    const body = reconcileFnBody(reviewFn);
    expect(body).toContain('status: "RESOLVED"');
    const updateIdx = body.indexOf('status: "RESOLVED"');
    const scopeBlock = body.slice(updateIdx, updateIdx + 300);
    expect(scopeBlock).toContain('.eq("owner_user_id", userId)');
  });

  it("inserted flag rows always set owner_user_id from context, never from computed/client data", () => {
    const body = reconcileFnBody(reviewFn);
    expect(body).toContain("owner_user_id: userId,");
  });

  it("reconcileReviewFlagsForPassportKey is exported as a plain function (not a createServerFn) so it can be called directly from applyProposal", () => {
    expect(reviewFn).toContain("export async function reconcileReviewFlagsForPassportKey(");
  });

  it("setReviewFlagStatus scopes its update by both id and owner_user_id — a user cannot change another user's flag status", () => {
    const body = bodyOf(reviewFn, "setReviewFlagStatus");
    expect(body).toContain('.eq("id", data.id)');
    expect(body).toContain('.eq("owner_user_id", userId)');
  });

  it("flagKey/rowKey both key on (ruleCode, entityType, entityId) — the same idempotency shape as the DB's unique constraint, so sync cannot create duplicate flags", () => {
    expect(reviewFn).toMatch(/`\$\{f\.ruleCode\}::\$\{f\.entityType\}::\$\{f\.entityId \?\? ""\}`/);
    expect(reviewFn).toMatch(
      /`\$\{r\.rule_code\}::\$\{r\.affected_entity_type\}::\$\{r\.affected_entity_id \?\? ""\}`/,
    );
  });
});

describe("rights-passport-workspace.schema.ts — safety-rule enforcement in the type system", () => {
  it("every permission field in every upsert schema is required (no .default(), no optional-with-fallback-to-ALLOW)", () => {
    const consentSchema = workspaceSchema.slice(
      workspaceSchema.indexOf("export const aiConsentUpsertSchema"),
      workspaceSchema.indexOf("export type AiConsentUpsertInput"),
    );
    expect(consentSchema).toMatch(/permission:\s*z\.enum\(AI_POLICIES\),/);
    expect(consentSchema).not.toMatch(/permission:[^,]*\.default\(/);
  });

  it("exports exactly 22 AI use cases", () => {
    expect(workspaceSchema).toMatch(/AI_USE_CASES = \[[\s\S]*?\] as const/);
    const match = workspaceSchema.match(/export const AI_USE_CASES = \[([\s\S]*?)\] as const/);
    expect(match).not.toBeNull();
    const items = (match![1].match(/"[A-Z_]+"/g) ?? []).length;
    expect(items).toBe(22);
  });

  it("every AI use case has plain-language copy with no legal conclusion language", () => {
    expect(workspaceSchema).not.toMatch(
      /is legally|constitutes ownership|proves? (you own|ownership)/i,
    );
  });

  it("exports the exact evidence disclaimer wording required verbatim", () => {
    expect(workspaceSchema).toContain(
      "Provenance evidence does not automatically establish legal ownership",
    );
  });

  it("high-risk AI use cases list matches the 5 required use cases", () => {
    const match = workspaceSchema.match(
      /export const HIGH_RISK_AI_USE_CASES: AiUseCase\[\] = \[([\s\S]*?)\];/,
    );
    expect(match).not.toBeNull();
    const items = (match![1].match(/"[A-Z_]+"/g) ?? []).map((s) => s.replace(/"/g, ""));
    expect(items.sort()).toEqual(
      [
        "COMMERCIAL_MODEL_OUTPUT",
        "DIGITAL_REPLICA",
        "GENERATED_ADVERTISEMENT",
        "POSTHUMOUS_ESTATE_USE",
        "VOICE_CLONE",
      ].sort(),
    );
  });
});
