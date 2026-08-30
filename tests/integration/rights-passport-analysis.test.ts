/**
 * AurumVault Digital Rights Passport Generator — Round 3 (Upload & Analyze)
 * security/regression guard.
 *
 * Same constraint as tests/integration/rights-passport-{foundation,
 * workspace}.test.ts: the Round 3 server functions pull in zod/
 * @supabase/supabase-js/pdfjs-dist/mammoth, none of which are installed in
 * this sandbox (confirmed: `bun -e "import('zod')"` fails with "Cannot find
 * package 'zod'"). This suite is therefore source-level verification of the
 * migration text and server-function source, covering the Round 3 spec's
 * explicit integration-test checklist (§16):
 *   1. owner can upload document metadata
 *   2. foreign user cannot read document
 *   3. owner can create analysis run
 *   4. foreign user cannot read analysis run
 *   5. finding cannot attach to foreign run/passport
 *   6. ACCEPT writes expected structured target
 *   7. REJECT does not mutate target
 *   8. EDIT applies edited value, not original AI value
 *   9. invalid model output does not mutate passport
 *   10. anonymous user cannot read documents/findings
 *
 * rights-passport-doc-chunk.test.ts, rights-passport-analysis-confidence
 * .test.ts, and rights-passport-analysis-prompts.test.ts cover what
 * genuinely runs (all pure, dependency-free logic) with real, executed
 * assertions — including source-page preservation, confidence banding,
 * the high-impact review-required override, prompt-injection-as-data
 * handling, and finding-key idempotency.
 *
 * Run: bun test tests/integration/rights-passport-analysis.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const migration = read(
  "docs/proposed-migrations/20260830090000_rights_passport_documents_analysis.sql",
);
const workspaceMigration = read(
  "docs/proposed-migrations/20260830013807_rights_passport_control_workspace.sql",
);
const documentsFn = read("src/lib/rights-passport-documents.functions.ts");
const analysisFn = read("src/lib/rights-passport-analysis.functions.ts");
const analysisSchema = read("src/lib/rights-passport-analysis-schema.ts");
const documentsSchema = read("src/lib/rights-passport-documents.schema.ts");
const docParseServer = read("src/lib/rights-passport-doc-parse.server.ts");

function bodyOf(source: string, exportName: string): string {
  const start = source.indexOf(`export const ${exportName}`);
  expect(start, `${exportName} should exist`).toBeGreaterThan(-1);
  const end = source.indexOf("\nexport const", start + 10);
  const endAsync = source.indexOf("\nasync function", start + 10);
  const endFn = source.indexOf("\nfunction ", start + 10);
  const candidates = [end, endAsync, endFn].filter((i) => i !== -1);
  const cut = candidates.length ? Math.min(...candidates) : -1;
  return source.slice(start, cut === -1 ? undefined : cut);
}

// ---------------------------------------------------------------------------
// Migration — additive only, staged, RLS, guard triggers
// ---------------------------------------------------------------------------

describe("migration — additive only, staged (not auto-applied)", () => {
  it("lives under docs/proposed-migrations, not supabase/migrations, so it is not auto-applied", () => {
    expect(migration.length).toBeGreaterThan(0);
  });

  it("never drops, truncates, or deletes existing data; never alters a pre-existing table", () => {
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).not.toMatch(/^\s*TRUNCATE TABLE/im);
    expect(migration).not.toMatch(/DELETE FROM/i);
    expect(migration).not.toMatch(
      /^ALTER TABLE public\.(rights_passports|rights_passport_assets|rights_ai_consents|rights_licenses|rights_evidence|rights_review_flags)\b/im,
    );
  });

  it("creates all 3 new tables with RLS enabled and no anon grant", () => {
    for (const table of [
      "rights_passport_documents",
      "rights_analysis_runs",
      "rights_analysis_findings",
    ]) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL ON public.${table} FROM anon`);
    }
  });

  it("(check 10) no new table has a public/anon SELECT policy — no anonymous read of documents or findings", () => {
    expect(migration).not.toMatch(/FOR SELECT TO (anon|public)/i);
  });

  it("(check 10) storage RLS on the digital-rights-evidence bucket has no anon policy either", () => {
    const bucketSection = migration.slice(migration.indexOf("digital-rights-evidence"));
    expect(bucketSection).not.toMatch(/TO anon/);
    expect(bucketSection).toContain("(storage.foldername(name))[1]");
  });

  it("every new table's SELECT/write policy is scoped to owner_user_id = auth.uid()", () => {
    for (const table of [
      "rights_passport_documents",
      "rights_analysis_runs",
      "rights_analysis_findings",
    ]) {
      const policyIdx = migration.indexOf(`"${table}_owner_read" ON public.${table}`);
      expect(policyIdx, `${table} owner_read policy should exist`).toBeGreaterThan(-1);
      expect(migration.slice(policyIdx, policyIdx + 300)).toMatch(
        /USING \(owner_user_id = auth\.uid\(\)/,
      );
    }
  });

  it("(check 5) a passport-ownership guard trigger runs on all 3 tables, blocking a row attached to a passport the caller does not own", () => {
    for (const table of [
      "rights_passport_documents",
      "rights_analysis_runs",
      "rights_analysis_findings",
    ]) {
      expect(migration).toContain(`${table}_guard_passport_owner_trg`);
    }
    // Reuses the exact function defined in the Round 2 migration — not redefined here.
    expect(migration).not.toContain(
      "CREATE OR REPLACE FUNCTION public.rights_workspace_guard_passport_owner()",
    );
    expect(workspaceMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.rights_workspace_guard_passport_owner()",
    );
  });

  it("(check 5) a document-ownership guard trigger blocks an analysis run/finding referencing a document outside its own passport", () => {
    expect(migration).toContain("rights_analysis_runs_guard_document_passport_trg");
    expect(migration).toContain("rights_analysis_findings_guard_document_passport_trg");
    expect(migration).toMatch(/doc_passport_key IS DISTINCT FROM NEW\.passport_key/);
    expect(migration).toContain("RAISE EXCEPTION 'Document does not belong to this passport'");
  });

  it("(check 5) a run-ownership guard trigger blocks a finding referencing an analysis run outside its own passport/document", () => {
    expect(migration).toContain("rights_analysis_findings_guard_run_passport_trg");
    expect(migration).toMatch(/run_passport_key IS DISTINCT FROM NEW\.passport_key/);
    expect(migration).toMatch(/run_document_id IS DISTINCT FROM NEW\.document_id/);
    expect(migration).toContain("RAISE EXCEPTION 'Analysis run does not belong to this document'");
  });

  it("no new table grants DELETE to authenticated — findings are rejected/deferred, never hard-deleted (audit history retained)", () => {
    for (const table of [
      "rights_passport_documents",
      "rights_analysis_runs",
      "rights_analysis_findings",
    ]) {
      expect(migration).toContain(
        `REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.${table} FROM authenticated`,
      );
    }
  });

  it("findings carry a unique idempotency key so a retried pass cannot create duplicates", () => {
    expect(migration).toMatch(
      /CONSTRAINT rights_analysis_findings_unique_key UNIQUE \(analysis_run_id, finding_key\)/,
    );
  });

  it("a finding's normalized_value (the AI's original output) is immutable once written — corrections go through edited_value instead", () => {
    expect(migration).toContain(
      "A finding''s AI-extracted value cannot be edited in place — record corrections in edited_value",
    );
  });

  it("findings default to review_status PENDING and applied_entity_type/_id NULL — nothing is auto-applied on insert", () => {
    const tableIdx = migration.indexOf("CREATE TABLE public.rights_analysis_findings");
    const tableBlock = migration.slice(tableIdx, tableIdx + 2500);
    expect(tableBlock).toMatch(
      /review_status public\.rights_finding_review_status NOT NULL DEFAULT 'PENDING'/,
    );
    expect(tableBlock).toMatch(/applied_entity_type TEXT,/);
    expect(tableBlock).not.toMatch(/applied_entity_type TEXT NOT NULL DEFAULT/);
  });

  it("the storage bucket is private (public: false) with an explicit mime/size allowlist", () => {
    const bucketIdx = migration.indexOf("INSERT INTO storage.buckets");
    const bucketBlock = migration.slice(bucketIdx, bucketIdx + 500);
    expect(bucketBlock).toMatch(/false,\s*\n\s*52428800/);
    expect(bucketBlock).toContain("application/pdf");
    expect(bucketBlock).toContain("text/plain");
  });
});

// ---------------------------------------------------------------------------
// rights-passport-documents.functions.ts
// ---------------------------------------------------------------------------

describe("rights-passport-documents.functions.ts — owner-scoped, verified upload", () => {
  it("every client-facing function requires requireSupabaseAuth", () => {
    for (const name of [
      "beginDocumentUpload",
      "registerDocument",
      "listDocuments",
      "getDocumentSignedUrl",
    ]) {
      expect(bodyOf(documentsFn, name)).toMatch(
        /\.middleware\(\[(?:requireRightsPassport\w+,\s*)?requireSupabaseAuth\]\)/,
      );
    }
  });

  it("(check 1) beginDocumentUpload verifies passport ownership before minting a storage path", () => {
    expect(bodyOf(documentsFn, "beginDocumentUpload")).toContain(
      "assertOwnsPassportKey(supabase, userId, data.passportKey)",
    );
  });

  it("(check 1) registerDocument verifies passport ownership AND that the storagePath matches the caller's own upload location", () => {
    const body = bodyOf(documentsFn, "registerDocument");
    expect(body).toContain("assertOwnsPassportKey(supabase, userId, data.passportKey)");
    expect(body).toContain("expectedPrefix");
    expect(body).toMatch(/storagePath\.startsWith\(expectedPrefix\)/);
  });

  it("(check 1) registerDocument verifies the object actually exists in storage (and its size matches) before inserting metadata — cannot register unread bytes", () => {
    const body = bodyOf(documentsFn, "registerDocument");
    expect(body).toContain(".storage");
    expect(body).toContain(".list(dir");
    expect(body).toMatch(/File not found in storage/);
    expect(body).toMatch(/Reported file size does not match/);
  });

  it("(check 2) listDocuments and getDocumentSignedUrl scope every query by owner_user_id — a foreign user cannot read another user's documents", () => {
    for (const name of ["listDocuments", "getDocumentSignedUrl"]) {
      expect(bodyOf(documentsFn, name)).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    }
  });

  it("getDocumentSignedUrl never returns storage_path directly — only a signed URL", () => {
    const body = bodyOf(documentsFn, "getDocumentSignedUrl");
    expect(body).toContain("createSignedUrl");
    expect(body).not.toMatch(/return\s*\{[^}]*storage_path/);
  });

  it("getDocumentInternal (server-internal accessor) also scopes by id AND owner_user_id, never exported as a client-callable server fn", () => {
    expect(documentsFn).not.toContain("export const getDocumentInternal");
    expect(documentsFn).toContain("export async function getDocumentInternal");
    const helper = documentsFn.slice(
      documentsFn.indexOf("export async function getDocumentInternal"),
    );
    expect(helper).toMatch(/\.eq\(\s*"id"[^)]*documentId\s*\)/);
    expect(helper).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
  });

  it("owner_user_id is always derived from context, never accepted from client input", () => {
    expect(documentsFn).not.toMatch(/ownerUserId/);
    expect(documentsFn).not.toMatch(/owner_user_id:\s*data\./);
  });
});

// ---------------------------------------------------------------------------
// rights-passport-analysis.functions.ts
// ---------------------------------------------------------------------------

describe("rights-passport-analysis.functions.ts — owner-scoped analysis pipeline", () => {
  it("every client-facing function requires requireSupabaseAuth", () => {
    for (const name of [
      "parseDocument",
      "createAnalysisRun",
      "listAnalysisRuns",
      "runAnalysisPass",
      "listFindings",
      "reviewFinding",
    ]) {
      expect(bodyOf(analysisFn, name)).toMatch(
        /\.middleware\(\[(?:requireRightsPassport\w+,\s*)?requireSupabaseAuth\]\)/,
      );
    }
  });

  it("(check 1/3) parseDocument and createAnalysisRun resolve the document through getDocumentInternal, which is itself owner-scoped", () => {
    expect(bodyOf(analysisFn, "parseDocument")).toContain(
      "getDocumentInternal(supabase, userId, data.documentId)",
    );
    expect(bodyOf(analysisFn, "createAnalysisRun")).toContain(
      "getDocumentInternal(supabase, userId, data.documentId)",
    );
  });

  it("(check 3) createAnalysisRun refuses to start analysis before the document is parsed", () => {
    const body = bodyOf(analysisFn, "createAnalysisRun");
    expect(body).toMatch(/doc\.parse_status !== "PARSED"/);
  });

  it("(check 4) listAnalysisRuns and runAnalysisPass scope every run lookup by owner_user_id — a foreign user cannot read or drive another user's analysis run", () => {
    expect(bodyOf(analysisFn, "listAnalysisRuns")).toMatch(
      /\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/,
    );
    const runPassBody = bodyOf(analysisFn, "runAnalysisPass");
    expect(runPassBody).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    expect(runPassBody).toContain('if (!runRow) throw new Error("Analysis run not found")');
  });

  it("(check 5) inserted findings always carry owner_user_id/passport_key/document_id derived from the already-verified run/document, never from raw model output", () => {
    const body = bodyOf(analysisFn, "runAnalysisPass");
    expect(body).toContain("owner_user_id: userId,");
    expect(body).toContain("passport_key: run.passport_key,");
    expect(body).toContain("document_id: run.document_id,");
  });

  it("(check 9) model output is validated with modelPassOutputSchema BEFORE any finding is built or inserted", () => {
    const body = bodyOf(analysisFn, "runAnalysisPass");
    const parseIdx = body.indexOf("modelPassOutputSchema(data.passType).safeParse(raw)");
    const insertBuildIdx = body.indexOf("const rowsToInsert");
    expect(parseIdx).toBeGreaterThan(-1);
    expect(insertBuildIdx).toBeGreaterThan(parseIdx);
  });

  it("(check 9) on validation failure, runAnalysisPass returns early via failPass and never reaches the insert — no findings, no passport mutation", () => {
    const body = bodyOf(analysisFn, "runAnalysisPass");
    const validationBlock = body.slice(
      body.indexOf("const parsed = modelPassOutputSchema"),
      body.indexOf("const rowsToInsert"),
    );
    expect(validationBlock).toContain("!parsed.success");
    expect(validationBlock).toContain("return await failPass(");
  });

  it("failPass never touches rights_analysis_findings — it only updates the run's pass_status/status/error_code", () => {
    const body = analysisFn.slice(
      analysisFn.indexOf("async function failPass"),
      analysisFn.indexOf("async function syncDocumentStatusAfterRun"),
    );
    expect(body).not.toContain("rights_analysis_findings");
    expect(body).toContain("rights_analysis_runs");
  });

  it("retries are idempotent: findings are upserted with ignoreDuplicates on the (analysis_run_id, finding_key) key, never a plain insert", () => {
    const body = bodyOf(analysisFn, "runAnalysisPass");
    expect(body).toMatch(
      /\.upsert\(deduped,\s*\{\s*onConflict:\s*"analysis_run_id,finding_key",\s*ignoreDuplicates:\s*true\s*\}\)/,
    );
  });

  it("findings are deduplicated by finding_key within a single pass's raw output before insert", () => {
    const body = bodyOf(analysisFn, "runAnalysisPass");
    expect(body).toContain("seenKeys.has(r.finding_key)");
  });

  it("(check 2/4/10) listFindings scopes by document_id AND owner_user_id — a foreign or anonymous caller cannot enumerate another user's findings", () => {
    const body = bodyOf(analysisFn, "listFindings");
    expect(body).toMatch(/\.eq\(\s*"document_id"[^)]*data\.documentId\s*\)/);
    expect(body).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
  });

  it("reviewFinding resolves the finding scoped by id AND owner_user_id before acting on it", () => {
    const body = bodyOf(analysisFn, "reviewFinding");
    expect(body).toMatch(/\.eq\(\s*"id"[^)]*data\.findingId\s*\)/);
    expect(body).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    expect(body).toContain('if (!findingRow) throw new Error("Finding not found")');
  });

  it("(check 7) REJECT never calls applyFindingToTarget — no other table is mutated, only review_status/reviewed_by/reviewed_at change", () => {
    const body = bodyOf(analysisFn, "reviewFinding");
    const rejectBranch = body.slice(
      body.indexOf('data.action === "REJECT"'),
      body.indexOf('data.action === "DEFER"'),
    );
    expect(rejectBranch).not.toContain("applyFindingToTarget");
    expect(rejectBranch).toContain('patch.review_status = "REJECTED"');
  });

  it("(check 6) ACCEPT calls applyFindingToTarget with the finding's normalized_value (the AI's original output)", () => {
    const body = bodyOf(analysisFn, "reviewFinding");
    const acceptBranch = body.slice(
      body.indexOf('data.action === "ACCEPT"'),
      body.indexOf('} else if (data.action === "EDIT")'),
    );
    expect(acceptBranch).toMatch(
      /applyFindingToTarget\(\s*supabase,\s*userId,\s*finding,\s*finding\.normalized_value,[\s\S]*?\)/,
    );
  });

  it("(check 8) EDIT calls applyFindingToTarget with data.editedValue — the user's correction — never finding.normalized_value", () => {
    const body = bodyOf(analysisFn, "reviewFinding");
    const editBranch = body.slice(body.indexOf('} else if (data.action === "EDIT")'));
    expect(editBranch).toMatch(
      /applyFindingToTarget\(\s*supabase,\s*userId,\s*finding,\s*data\.editedValue,[\s\S]*?\)/,
    );
    expect(editBranch).not.toMatch(
      /applyFindingToTarget\(\s*supabase,\s*userId,\s*finding,\s*finding\.normalized_value,[\s\S]*?\)/,
    );
  });

  it("(check 8) EDIT requires editedValue to be provided — cannot silently fall back to the AI value", () => {
    const body = bodyOf(analysisFn, "reviewFinding");
    expect(body).toContain('if (data.action === "EDIT" && data.editedValue === undefined)');
    expect(body).toContain('throw new Error("editedValue is required for an EDIT action")');
  });

  it("(check 6) applyFindingToTarget only writes a structured record for a recognized suggested_target — never fabricates a License/Evidence record from a single field", () => {
    const body = analysisFn.slice(
      analysisFn.indexOf("async function applyFindingToTarget"),
      analysisFn.indexOf("export const reviewFinding"),
    );
    expect(body).toMatch(/target\.entity !== "ai_consent"/);
    expect(body).toContain("rights_ai_consents");
    expect(body).not.toContain("rights_licenses");
    expect(body).not.toContain("rights_evidence");
  });

  it("applyFindingToTarget validates the value against the real AI_POLICIES enum before writing — a malformed/hallucinated permission is rejected, not silently written", () => {
    const body = analysisFn.slice(
      analysisFn.indexOf("async function applyFindingToTarget"),
      analysisFn.indexOf("export const reviewFinding"),
    );
    expect(body).toContain("z.enum(AI_POLICIES).safeParse(value)");
    expect(body).toContain("!permissionCheck.success");
  });

  it("owner_user_id is always derived from context in this file too, never accepted from client input", () => {
    expect(analysisFn).not.toMatch(/ownerUserId/);
    expect(analysisFn).not.toMatch(/owner_user_id:\s*data\./);
  });
});

// ---------------------------------------------------------------------------
// Prompt-injection defense wiring (architectural — the actual defense
// content itself is real-executed in rights-passport-analysis-prompts.test.ts)
// ---------------------------------------------------------------------------

describe("runAnalysisPass — prompt-injection defense wiring", () => {
  it("the system prompt is built from static pass metadata only — document text is never interpolated into it", () => {
    const body = bodyOf(analysisFn, "runAnalysisPass");
    const systemCallIdx = body.indexOf("buildSystemPrompt({");
    const systemCallBlock = body.slice(systemCallIdx, systemCallIdx + 200);
    expect(systemCallBlock).not.toContain("documentText");
  });

  it("document text is only ever passed to buildUserPrompt, which is documented to delimit it as untrusted data", () => {
    const body = bodyOf(analysisFn, "runAnalysisPass");
    expect(body).toContain("buildUserPrompt({ documentId: doc.id, documentText })");
  });
});

// ---------------------------------------------------------------------------
// Schema / parsing modules — shape and safety checks
// ---------------------------------------------------------------------------

describe("rights-passport-analysis-schema.ts — no silent write path, high-impact list intact", () => {
  it("modelFindingSchema requires confidence, review_required, and field on every finding — no optional-away-the-safety-rails", () => {
    const fn = analysisSchema.slice(
      analysisSchema.indexOf("export function modelFindingSchema"),
      analysisSchema.indexOf("export function modelPassOutputSchema"),
    );
    expect(fn).toContain("confidence: z.number().min(0).max(1),");
    expect(fn).toContain("review_required: z.boolean(),");
    expect(fn).not.toMatch(/confidence:[^,]*\.optional\(\)/);
    expect(fn).not.toMatch(/review_required:[^,]*\.optional\(\)/);
  });

  it("HIGH_IMPACT_FIELD_KEYS matches the literal list duplicated in rights-passport-analysis-confidence.ts / its tests", () => {
    const match = analysisSchema.match(
      /export const HIGH_IMPACT_FIELD_KEYS = \[([\s\S]*?)\] as const/,
    );
    expect(match).not.toBeNull();
    const items = (match![1].match(/"[A-Z_]+::[a-z_]+"/g) ?? []).map((s) => s.replace(/"/g, ""));
    expect(items.sort()).toEqual(
      [
        "RIGHTS_GRANT::ownership_language",
        "RIGHTS_GRANT::assignment",
        "RIGHTS_GRANT::exclusivity",
        "RIGHTS_GRANT::sublicensing",
        "AI_SYNTHETIC_RIGHTS::ai_training",
        "AI_SYNTHETIC_RIGHTS::voice_cloning",
        "AI_SYNTHETIC_RIGHTS::digital_replica",
        "AI_SYNTHETIC_RIGHTS::posthumous_use",
        "RISK_CONFLICT_SIGNALS::perpetual_rights",
        "RISK_CONFLICT_SIGNALS::irrevocable_rights",
        "RISK_CONFLICT_SIGNALS::unlimited_sublicensing",
        "RISK_CONFLICT_SIGNALS::conflict_with_passport_defaults",
        "RISK_CONFLICT_SIGNALS::conflict_with_active_license",
        "RISK_CONFLICT_SIGNALS::governing_law_conflict",
      ].sort(),
    );
  });

  it("exports the required AI safety disclaimer text verbatim", () => {
    expect(analysisSchema).toContain(
      "AI analysis identifies possible rights, terms, and risks from the uploaded document. It is not a legal opinion. Review all findings before adding them to your Digital Rights Passport.",
    );
  });

  it("never claims legal invalidity/ownership/unenforceability as a system fact anywhere in this module", () => {
    expect(analysisSchema).not.toMatch(/is legally invalid|you own these rights|is unenforceable/i);
  });
});

describe("rights-passport-documents.schema.ts — upload safety", () => {
  it("MAX_DOCUMENT_BYTES matches the migration's size CHECK constraint (50 MB)", () => {
    expect(documentsSchema).toContain("MAX_DOCUMENT_BYTES = 50 * 1024 * 1024");
    expect(migration).toContain("file_size_bytes > 0 AND file_size_bytes <= 52428800");
  });

  it("ALLOWED_MIME_TYPES matches the migration's mime CHECK constraint exactly", () => {
    for (const mime of [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]) {
      expect(documentsSchema).toContain(mime);
      expect(migration).toContain(mime);
    }
  });

  it("sanitizeFileName strips path separators and traversal segments — cannot be used to escape the storage path prefix", () => {
    const fn = documentsSchema.slice(
      documentsSchema.indexOf("export function sanitizeFileName"),
      documentsSchema.indexOf("export const registerDocumentSchema"),
    );
    expect(fn).toContain("name.split(/[/\\\\]/)");
    expect(fn).toMatch(/replace\(\/\[\^a-zA-Z0-9/);
  });
});

describe("rights-passport-doc-parse.server.ts — reuses installed parser libraries, never fabricates OCR text", () => {
  it("PDF parsing uses pdfjs-dist's legacy build, same as ManuscriptPreviewer.tsx's client-side pattern", () => {
    expect(docParseServer).toContain('import("pdfjs-dist/legacy/build/pdf.mjs")');
    expect(docParseServer).toContain("ensurePdfJsRuntimeCompat");
  });

  it("DOCX parsing uses the installed mammoth package", () => {
    expect(docParseServer).toContain('import("mammoth")');
    expect(docParseServer).toContain("extractRawText");
  });

  it("an image-only (OCR-required) PDF is flagged, never silently returned as empty/fabricated text", () => {
    expect(docParseServer).toContain("looksLikeOcrRequired(pageTexts)");
    expect(docParseServer).toContain("ocrRequired: true");
  });

  it("a parse failure returns a safe error shape, never throws an unhandled exception across the module boundary", () => {
    expect(docParseServer).toMatch(/errorCode: "PDF_PARSE_FAILED"/);
    expect(docParseServer).toMatch(/errorCode: "DOCX_PARSE_FAILED"/);
  });
});
