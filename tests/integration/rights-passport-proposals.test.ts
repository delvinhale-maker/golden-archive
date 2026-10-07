/**
 * AurumVault Digital Rights Passport Generator — Round 3.5 (Structured
 * Apply + Branch Hardening) security/regression guard.
 *
 * Same constraint as every other tests/integration/rights-passport-*.test.ts
 * file: rights-passport-proposals.functions.ts pulls in zod/
 * @supabase/supabase-js, neither installed in this sandbox. This suite is
 * therefore source-level verification, covering the Round 3.5 spec's
 * explicit integration/security checklist (§K):
 *   1. foreign finding cannot apply
 *   2. foreign target asset cannot update
 *   3. foreign passport cannot receive proposal
 *   4. accepted license proposal creates only one record
 *   5. repeated application remains idempotent
 *   6. evidence defaults to SELF_DECLARED / REVIEW_REQUIRED, never auto-VERIFIED
 *   7. AI-derived ownership does not become verified ownership
 *   8. rejected/deferred findings leave structured tables untouched
 *
 * rights-passport-proposal-assembly.test.ts and rights-passport-risk-rules
 * .test.ts cover what genuinely runs (all pure logic) with real, executed
 * assertions — including multi-clause license assembly, missing-field
 * detection, high-impact confirmation requirements, and the new
 * LICENSE_COMPETING_EXCLUSIVE conflict rule.
 *
 * Run: bun test tests/integration/rights-passport-proposals.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const proposalsFn = read("src/lib/rights-passport-proposals.functions.ts");
const analysisFn = read("src/lib/rights-passport-analysis.functions.ts");
const reviewFn = read("src/lib/rights-passport-review.functions.ts");
const assemblyModule = read("src/lib/rights-passport-proposal-assembly.ts");
const analysisSchema = read("src/lib/rights-passport-analysis-schema.ts");

function bodyOf(source: string, exportName: string): string {
  const start = source.indexOf(`export const ${exportName}`);
  expect(start, `${exportName} should exist`).toBeGreaterThan(-1);
  const end = source.indexOf("\nexport const", start + 10);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("rights-passport-proposals.functions.ts — auth and ownership", () => {
  it("both client-facing functions require requireSupabaseAuth", () => {
    for (const name of ["listProposals", "applyProposal"]) {
      expect(bodyOf(proposalsFn, name)).toMatch(
        /\.middleware\(\[(?:requireRightsPassport\w+,\s*)?requireSupabaseAuth\]\)/,
      );
    }
  });

  it("(check 3) listProposals resolves the document through getDocumentInternal, which is owner-scoped — a foreign passport cannot receive a proposal listing for a document that isn't the caller's", () => {
    expect(bodyOf(proposalsFn, "listProposals")).toContain(
      "getDocumentInternal(supabase, userId, data.documentId)",
    );
  });

  it("(check 3) applyProposal also resolves the document through getDocumentInternal before touching any finding or target table", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    const docIdx = body.indexOf("getDocumentInternal(supabase, userId, data.documentId)");
    const findIdx = body.indexOf("rights_analysis_findings");
    expect(docIdx).toBeGreaterThan(-1);
    expect(findIdx).toBeGreaterThan(docIdx);
  });

  it("(check 1) applyProposal re-verifies every sourceFindingId is scoped by owner_user_id AND document_id, and rejects if any id doesn't match — a foreign finding (or one from a different document) cannot be smuggled into a proposal", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    expect(body).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    expect(body).toMatch(/\.eq\(\s*"document_id"[^)]*doc\.id\s*\)/);
    expect(body).toContain("findings.length !== data.sourceFindingIds.length");
    expect(body).toContain(
      "One or more findings in this proposal could not be verified for this document.",
    );
  });

  it("(check 2) assertAssetOwnership scopes the target asset by id, passport_key, AND owner_user_id — a foreign asset cannot be selected as a match/update target", () => {
    const helper = proposalsFn.slice(
      proposalsFn.indexOf("async function assertAssetOwnership"),
      proposalsFn.indexOf("export const applyProposal"),
    );
    expect(helper).toMatch(/\.eq\(\s*"id"[^)]*assetId\s*\)/);
    expect(helper).toMatch(/\.eq\(\s*"passport_key"[^)]*passportKey\s*\)/);
    expect(helper).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    expect(helper).toContain("Target asset not found");
  });

  it("LICENSE and EVIDENCE application both call assertAssetOwnership before writing — the target asset is never trusted from client input alone", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    const licenseBlock = body.slice(
      body.indexOf('proposalType === "LICENSE"'),
      body.indexOf('proposalType === "EVIDENCE"'),
    );
    const evidenceBlock = body.slice(
      body.indexOf('proposalType === "EVIDENCE"'),
      body.indexOf('proposalType === "PROFILE_UPDATE"'),
    );
    const ownershipCallPattern =
      /assertAssetOwnership\(\s*supabase,\s*userId,\s*doc\.passport_key,\s*data\.assetSelection\.assetId,?\s*\)/;
    expect(licenseBlock).toMatch(ownershipCallPattern);
    expect(evidenceBlock).toMatch(ownershipCallPattern);
  });

  it("owner_user_id is always derived from context, never accepted from client input", () => {
    expect(proposalsFn).not.toMatch(/ownerUserId/);
    expect(proposalsFn).not.toMatch(/owner_user_id:\s*data\./);
  });
});

describe("applyProposal — idempotency (check 4, 5)", () => {
  it("(check 5) detects a fully-applied proposal (every finding already stamped with the same applied_entity_id) and returns ALREADY_APPLIED without writing again", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    expect(body).toMatch(
      /findings\.every\(\(f\) => f\.applied_entity_id\)\s*&&\s*appliedIds\.size === 1\s*&&\s*appliedTypes\.size === 1/,
    );
    expect(body).toContain('status: "ALREADY_APPLIED"');
    const idempotencyIdx = body.indexOf("ALREADY_APPLIED");
    const licenseInsertIdx = body.indexOf('.from("rights_licenses"');
    expect(idempotencyIdx).toBeLessThan(licenseInsertIdx);
  });

  it("(check 4) LICENSE application performs exactly one insert into rights_licenses per applyProposal call — no loop, no batch insert of multiple license rows", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    const matches = body.match(/\.from\("rights_licenses" as never\)/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("stampFindings always sets applied_entity_type/_id on every constituent finding after a successful write, so a subsequent retry's idempotency check can find them", () => {
    const helper = proposalsFn.slice(
      proposalsFn.indexOf("async function stampFindings"),
      proposalsFn.indexOf("async function assertAssetOwnership"),
    );
    expect(helper).toContain("applied_entity_type: appliedEntityType");
    expect(helper).toContain("applied_entity_id: appliedEntityId");
    expect(helper).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
  });

  it("the canonical proposedRecord is recomputed server-side from verified findings, never trusted wholesale from the client — editedRecord is only applied as an override layer on top", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    expect(body).toMatch(
      /assembleProposals\(\s*doc\.id,\s*doc\.original_file_name,\s*findings\.map\(toAssemblyFinding\),?\s*\)/,
    );
    expect(body).toMatch(
      /\.\.\.recomputed\.proposedRecord,\s*\n?\s*\.\.\.\(data\.editedRecord \?\? \{\}\)/,
    );
  });
});

describe("applyProposal — never-VERIFIED, never-ACTIVE, never-fact safety rules", () => {
  it("(check 6) evidence status is REVIEW_REQUIRED for registration/identity-shaped types and SELF_DECLARED otherwise — VERIFIED never appears as a possible assignment anywhere in this file", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    const evidenceBlock = body.slice(
      body.indexOf('proposalType === "EVIDENCE"'),
      body.indexOf('proposalType === "PROFILE_UPDATE"'),
    );
    expect(evidenceBlock).toContain('"SELF_DECLARED"');
    expect(evidenceBlock).not.toMatch(/status:\s*"VERIFIED"/);
    expect(proposalsFn).not.toMatch(/status:\s*['"]VERIFIED['"]/);
  });

  it("license status is hard-coded REVIEW_REQUIRED at creation, ignoring any editedRecord.status the client might send — never inferred ACTIVE merely because the contract exists", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    const licenseBlock = body.slice(
      body.indexOf('proposalType === "LICENSE"'),
      body.indexOf('proposalType === "EVIDENCE"'),
    );
    expect(licenseBlock).toMatch(/status:\s*"REVIEW_REQUIRED",\s*\n\s*notes:/);
    expect(licenseBlock).not.toMatch(/status:\s*record\.status/);
  });

  it("(check 7) asset creation/update always writes control_basis, defaulting to REVIEW_REQUIRED — AI-derived ownership/assignment language never becomes a verified control basis by default", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    expect(body).toMatch(
      /record\.controlBasis as \(typeof CONTROL_BASES\)\[number\]\)\s*:\s*"REVIEW_REQUIRED"/,
    );
  });

  it("the ASSET assembly module never asserts ownership as fact — description uses hedged 'appears to state' language (verified in the pure module's own tests; re-checked here at the source-text level too)", () => {
    expect(assemblyModule).toContain("appears to state");
    expect(assemblyModule).not.toMatch(/`You own|"You own/i);
  });
});

describe("applyProposal — REJECT/DEFER never mutate a target (check 8)", () => {
  it("REJECT stamps findings with review_status REJECTED and null applied_entity fields, returning before any target-table branch is reached", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    const rejectIdx = body.indexOf('data.action === "REJECT"');
    const deferIdx = body.indexOf('data.action === "DEFER"');
    const rejectBlock = body.slice(rejectIdx, deferIdx);
    expect(rejectBlock).toContain(
      'stampFindings(supabase, userId, doc.id, data.sourceFindingIds, "REJECTED", null, null)',
    );
    expect(rejectBlock).toContain("return {");
  });

  it("DEFER stamps findings with review_status DEFERRED and null applied_entity fields, returning before any target-table branch is reached", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    const deferIdx = body.indexOf('data.action === "DEFER"');
    const idempotencyIdx = body.indexOf("IDEMPOTENCY");
    const deferBlock = body.slice(deferIdx, idempotencyIdx);
    expect(deferBlock).toContain(
      'stampFindings(supabase, userId, doc.id, data.sourceFindingIds, "DEFERRED", null, null)',
    );
    expect(deferBlock).toContain("return {");
  });

  it("neither the REJECT nor DEFER code path references rights_passport_assets, rights_licenses, rights_evidence, or rights_passports", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    const rejectIdx = body.indexOf('data.action === "REJECT"');
    const acceptGateIdx = body.indexOf("IDEMPOTENCY");
    const decidedEarlyBlock = body.slice(rejectIdx, acceptGateIdx);
    for (const table of ["rights_passport_assets", "rights_licenses", "rights_evidence"]) {
      expect(decidedEarlyBlock).not.toContain(table);
    }
  });
});

describe("applyProposal — high-impact confirmation gate", () => {
  it("throws (refusing to apply) when requiresHighImpactConfirmation is true and confirmHighImpact was not passed", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    expect(body).toContain("recomputed.requiresHighImpactConfirmation && !data.confirmHighImpact");
    expect(body).toContain(
      "This is a high-impact rights finding. Confirm that you want this information recorded",
    );
  });

  it("the high-impact confirmation check runs BEFORE any target table is written", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    const confirmIdx = body.indexOf("requiresHighImpactConfirmation && !data.confirmHighImpact");
    const assetInsertIdx = body.indexOf(
      '.from("rights_passport_assets" as never) as any)\n          .insert',
    );
    expect(confirmIdx).toBeGreaterThan(-1);
    expect(assetInsertIdx).toBeGreaterThan(confirmIdx);
  });
});

describe("applyProposal — PROFILE_UPDATE never silently overwrites an existing value", () => {
  it("checks hasConflictingExistingValue against the passport's current column value before writing, and refuses without confirmOverwrite", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    const profileBlock = body.slice(body.indexOf('proposalType === "PROFILE_UPDATE"'));
    expect(profileBlock).toContain(
      "hasConflictingExistingValue(currentValue, newValue) && !data.confirmOverwrite",
    );
    expect(profileBlock).toContain("already has a value for this field");
  });

  it("scopes the passport update by both id and owner_user_id", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    const profileBlock = body.slice(body.indexOf('proposalType === "PROFILE_UPDATE"'));
    expect(profileBlock).toMatch(/\.eq\(\s*"id"[^)]*passport\.id\s*\)/);
    expect(profileBlock).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
  });
});

describe("applyProposal — reconciles risk flags after every successful structured write (§I)", () => {
  it("calls reconcileReviewFlagsForPassportKey after stamping findings, so readiness/risk state is never left stale", () => {
    const body = bodyOf(proposalsFn, "applyProposal");
    const reconcileIdx = body.indexOf(
      "reconcileReviewFlagsForPassportKey(supabase, userId, doc.passport_key)",
    );
    const stampMatch = body.match(
      /await stampFindings\(\s*supabase,\s*userId,\s*doc\.id,\s*data\.sourceFindingIds,\s*reviewStatus/,
    );
    expect(stampMatch).not.toBeNull();
    const stampIdx = body.indexOf(stampMatch![0]);
    expect(stampIdx).toBeGreaterThan(-1);
    expect(reconcileIdx).toBeGreaterThan(stampIdx);
  });

  it("imports the shared core from rights-passport-review.functions.ts rather than re-implementing flag reconciliation", () => {
    expect(proposalsFn).toContain(
      'import { reconcileReviewFlagsForPassportKey } from "@/lib/rights-passport-review.functions"',
    );
    expect(reviewFn).toContain("export async function reconcileReviewFlagsForPassportKey(");
  });
});

describe("rights-passport-analysis.functions.ts — AI Consent overwrite protection (Round 3.5 §5 hardening)", () => {
  it("applyFindingToTarget checks for an existing, differing consent value before upserting", () => {
    const body = analysisFn.slice(
      analysisFn.indexOf("async function applyFindingToTarget"),
      analysisFn.indexOf("export const reviewFinding"),
    );
    expect(body).toContain('.from("rights_ai_consents" as never)\n    .select("id,permission"');
    expect(body).toContain(
      "hasConflictingExistingValue(existingRow.permission, permissionCheck.data)",
    );
    expect(body).toContain("!confirmOverwrite");
    expect(body).toContain("ExistingValueConflictError");
  });

  it("the existing-consent lookup is scoped by passport_key, owner_user_id, asset_id IS NULL, and use_case — the exact same row the upsert's onConflict targets", () => {
    const body = analysisFn.slice(
      analysisFn.indexOf("async function applyFindingToTarget"),
      analysisFn.indexOf("export const reviewFinding"),
    );
    expect(body).toMatch(/\.eq\(\s*"passport_key"[^)]*finding\.passport_key\s*\)/);
    expect(body).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    expect(body).toMatch(/\.is\(\s*"asset_id"[^)]*null\s*\)/);
    expect(body).toMatch(/\.eq\(\s*"use_case"[^)]*useCase\s*\)/);
  });

  it("reviewFinding threads confirmOverwrite through to applyFindingToTarget on both ACCEPT and EDIT", () => {
    const body = bodyOf(analysisFn, "reviewFinding");
    const matches = body.match(/data\.confirmOverwrite \?\? false/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("the reviewSchema accepts an optional confirmOverwrite boolean", () => {
    const schemaBlock = analysisFn.slice(
      analysisFn.indexOf("const reviewSchema = z.object({"),
      analysisFn.indexOf("export class ExistingValueConflictError"),
    );
    expect(schemaBlock).toContain("confirmOverwrite: z.boolean().optional()");
  });
});

describe("rights-passport-analysis-schema.ts — HIGH_IMPACT_FIELD_KEYS still matches the proposal-assembly module's usage", () => {
  it("assembly module imports isHighImpactField from the pure confidence module, not a redefinition", () => {
    expect(assemblyModule).toContain(
      'import { isHighImpactField } from "@/lib/rights-passport-analysis-confidence"',
    );
  });

  it("AI_FIELD_TO_USE_CASE duplicated in the assembly module matches the schema module's copy", () => {
    const schemaMatch = analysisSchema.match(
      /export const AI_FIELD_TO_USE_CASE: Record<string, string> = \{([\s\S]*?)\n\};/,
    );
    const assemblyMatch = assemblyModule.match(
      /const AI_FIELD_TO_USE_CASE: Record<string, string> = \{([\s\S]*?)\n\};/,
    );
    expect(schemaMatch).not.toBeNull();
    expect(assemblyMatch).not.toBeNull();
    const parseEntries = (block: string) =>
      Object.fromEntries([...block.matchAll(/(\w+):\s*"([A-Z_]+)"/g)].map((m) => [m[1], m[2]]));
    expect(parseEntries(assemblyMatch![1])).toEqual(parseEntries(schemaMatch![1]));
  });
});
