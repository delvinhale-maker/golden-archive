/**
 * AurumVault Digital Rights Passport Generator — Round 3 Upload & Analyze
 * server functions: parse -> multi-pass analyze -> evidence-grounded review
 * queue -> explicit-accept-only structured write.
 *
 * WORKFLOW (spec §Round 3 goal): UPLOAD -> PARSE -> ANALYZE (multi-pass) ->
 * EVIDENCE-GROUND -> USER REVIEW -> ACCEPT/EDIT/REJECT -> ONLY THEN write
 * structured rights data. Nothing in this file ever writes to
 * rights_ai_consents / rights_licenses / rights_evidence / rights_passport_
 * assets except reviewFinding's ACCEPT/EDIT path, and only after the model
 * output has already passed Zod validation AND a human has explicitly
 * confirmed it finding-by-finding.
 *
 * Each pass is independently retryable (§13): runAnalysisPass IS the retry
 * path — calling it again for a FAILED pass re-attempts just that pass.
 * Findings use a deterministic idempotency key (rights-passport-analysis-
 * confidence.ts's buildFindingKey) with the DB's UNIQUE (analysis_run_id,
 * finding_key) constraint, upserted with ignoreDuplicates so a retry can
 * never duplicate a finding or clobber a finding a user already reviewed.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRightsPassportAiEnabled } from "@/lib/rights-passport-feature-flags.middleware";
import { AI_POLICIES } from "@/lib/rights-passport.schema";
import { getDocumentInternal } from "@/lib/rights-passport-documents.functions";
import {
  DOCUMENT_LIST_COLS,
  type DocumentRow,
  type ParsedPage,
} from "@/lib/rights-passport-documents.schema";
import { parseDocumentBytes } from "@/lib/rights-passport-doc-parse.server";
import { boundDocumentText } from "@/lib/rights-passport-doc-chunk";
import {
  ANALYSIS_PASS_TYPES,
  PASS_FIELDS,
  PASS_LABELS,
  AI_FIELD_TO_USE_CASE,
  ANALYSIS_RUN_COLS,
  FINDING_COLS,
  modelPassOutputSchema,
  type AnalysisPassType,
  type AnalysisRunRow,
  type FindingRow,
} from "@/lib/rights-passport-analysis-schema";
import { applyReviewOverride, buildFindingKey } from "@/lib/rights-passport-analysis-confidence";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/rights-passport-analysis-prompts";
import { hasConflictingExistingValue } from "@/lib/rights-passport-proposal-assembly";

const DOCUMENT_BUCKET = "digital-rights-evidence";
const MAX_PASS_CHARS = 60_000;

async function assertOwnsPassportKey(
  supabase: any,
  userId: string,
  passportKey: string,
): Promise<void> {
  const { data } = await supabase
    .from("rights_passports" as never)
    .select("id" as never)
    .eq("passport_key" as never, passportKey)
    .eq("owner_user_id" as never, userId)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("Passport not found");
}

// ---------------------------------------------------------------------------
// PARSE
// ---------------------------------------------------------------------------

const parseSchema = z.object({ documentId: z.string().uuid() });

export const parseDocument = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportAiEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => parseSchema.parse(input))
  .handler(async ({ data, context }): Promise<DocumentRow> => {
    const { supabase, userId } = context;
    const doc = await getDocumentInternal(supabase, userId, data.documentId);

    await (supabase.from("rights_passport_documents" as never) as any)
      .update({ parse_status: "PARSING", status: "PARSING" })
      .eq("id", doc.id)
      .eq("owner_user_id", userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dl = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).download(doc.storage_path);
    if (dl.error || !dl.data) {
      const { data: row } = await (supabase.from("rights_passport_documents" as never) as any)
        .update({
          parse_status: "FAILED",
          status: "FAILED",
          error_code: "DOCUMENT_NOT_FOUND",
          error_message_safe: "Couldn't read the uploaded file. Please re-upload it.",
        })
        .eq("id", doc.id)
        .eq("owner_user_id", userId)
        .select(DOCUMENT_LIST_COLS)
        .maybeSingle();
      return row as DocumentRow;
    }

    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    const result = await parseDocumentBytes(doc.mime_type, bytes);

    if (!result.ok) {
      const { data: row, error } = await (
        supabase.from("rights_passport_documents" as never) as any
      )
        .update({
          parse_status: "FAILED",
          status: "FAILED",
          error_code: result.errorCode,
          error_message_safe: result.errorMessageSafe,
        })
        .eq("id", doc.id)
        .eq("owner_user_id", userId)
        .select(DOCUMENT_LIST_COLS)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return row as DocumentRow;
    }

    const parseStatus = result.ocrRequired ? "OCR_REQUIRED" : "PARSED";
    const status = result.ocrRequired ? "FAILED" : "PARSED";
    const { data: row, error } = await (supabase.from("rights_passport_documents" as never) as any)
      .update({
        parse_status: parseStatus,
        status,
        page_count: result.pageCount,
        parsed_content: result.pages,
        parsed_at: new Date().toISOString(),
        error_code: result.ocrRequired ? "OCR_REQUIRED" : null,
        error_message_safe: result.ocrRequired
          ? "This document has no extractable text layer (scanned/image-only). OCR is not yet supported."
          : null,
      })
      .eq("id", doc.id)
      .eq("owner_user_id", userId)
      .select(DOCUMENT_LIST_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as DocumentRow;
  });

// ---------------------------------------------------------------------------
// ANALYSIS RUNS
// ---------------------------------------------------------------------------

const createRunSchema = z.object({ documentId: z.string().uuid() });

export const createAnalysisRun = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportAiEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => createRunSchema.parse(input))
  .handler(async ({ data, context }): Promise<AnalysisRunRow> => {
    const { supabase, userId } = context;
    const doc = await getDocumentInternal(supabase, userId, data.documentId);
    if (doc.parse_status !== "PARSED") {
      throw new Error(
        "This document must be parsed (with extractable text) before it can be analyzed.",
      );
    }

    const { data: row, error } = await (supabase.from("rights_analysis_runs" as never) as any)
      .insert({
        owner_user_id: userId,
        passport_key: doc.passport_key,
        document_id: doc.id,
        status: "PENDING",
        pass_status: {},
        model: null,
      })
      .select(ANALYSIS_RUN_COLS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't start analysis");

    await (supabase.from("rights_passport_documents" as never) as any)
      .update({ status: "ANALYZING", analysis_status: "ANALYZING" })
      .eq("id", doc.id)
      .eq("owner_user_id", userId);

    return row;
  });

export const listAnalysisRuns = createServerFn({ method: "GET" })
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(input),
  )
  .middleware([requireRightsPassportAiEnabled, requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<AnalysisRunRow[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("rights_analysis_runs" as never)
      .select(ANALYSIS_RUN_COLS as never)
      .eq("document_id" as never, data.documentId)
      .eq("owner_user_id" as never, userId)
      .order("created_at" as never, { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as AnalysisRunRow[];
  });

function recomputeRunStatus(
  passStatus: Record<string, string>,
): "PENDING" | "RUNNING" | "COMPLETE" | "PARTIAL" | "FAILED" {
  const values = ANALYSIS_PASS_TYPES.map((p) => passStatus[p]).filter(Boolean);
  if (values.length === 0) return "PENDING";
  if (values.some((v) => v === "RUNNING")) return "RUNNING";
  const allAttempted = ANALYSIS_PASS_TYPES.every(
    (p) => passStatus[p] === "COMPLETE" || passStatus[p] === "FAILED",
  );
  const anyComplete = values.some((v) => v === "COMPLETE");
  const allComplete = ANALYSIS_PASS_TYPES.every((p) => passStatus[p] === "COMPLETE");
  if (allComplete) return "COMPLETE";
  if (allAttempted && anyComplete) return "PARTIAL";
  if (allAttempted && !anyComplete) return "FAILED";
  return "RUNNING";
}

async function callAnthropicJson(system: string, user: string): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Anthropic API error (${res.status}): ${errText.slice(0, 500) || res.statusText}`,
    );
  }

  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text =
    json.content
      ?.filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("\n") ?? "";

  // Models sometimes wrap JSON in a markdown fence despite instructions —
  // strip it defensively before parsing (this does NOT relax validation:
  // the parsed value must still pass modelPassOutputSchema below).
  const stripped = text
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(stripped);
}

const runPassSchema = z.object({
  runId: z.string().uuid(),
  passType: z.enum(ANALYSIS_PASS_TYPES),
});

export type RunPassResult =
  | { ok: true; insertedCount: number; skippedCount: number }
  | { ok: false; errorCode: string; errorMessageSafe: string };

export const runAnalysisPass = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportAiEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => runPassSchema.parse(input))
  .handler(async ({ data, context }): Promise<RunPassResult> => {
    const { supabase, userId } = context;
    const { data: runRow, error: runErr } = await supabase
      .from("rights_analysis_runs" as never)
      .select(ANALYSIS_RUN_COLS as never)
      .eq("id" as never, data.runId)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (runErr) throw new Error(runErr.message);
    if (!runRow) throw new Error("Analysis run not found");
    const run = runRow as unknown as AnalysisRunRow;

    const doc = await getDocumentInternal(supabase, userId, run.document_id);
    const passStatus: Record<string, string> = { ...run.pass_status, [data.passType]: "RUNNING" };
    await (supabase.from("rights_analysis_runs" as never) as any)
      .update({
        pass_status: passStatus,
        status: recomputeRunStatus(passStatus),
        started_at: run.started_at ?? new Date().toISOString(),
      })
      .eq("id", run.id)
      .eq("owner_user_id", userId);

    const pages: ParsedPage[] = doc.parsed_content ?? [];
    const documentText = boundDocumentText(pages, MAX_PASS_CHARS);
    const system = buildSystemPrompt({
      passType: data.passType,
      passLabel: PASS_LABELS[data.passType],
      fields: PASS_FIELDS[data.passType],
    });
    const user = buildUserPrompt({ documentId: doc.id, documentText });

    let raw: unknown;
    try {
      raw = await callAnthropicJson(system, user);
    } catch (e: any) {
      return await failPass(
        supabase,
        userId,
        run,
        data.passType,
        passStatus,
        "MODEL_CALL_FAILED",
        e?.message ?? "The AI analysis call failed.",
      );
    }

    const parsed = modelPassOutputSchema(data.passType).safeParse(raw);
    if (!parsed.success) {
      return await failPass(
        supabase,
        userId,
        run,
        data.passType,
        passStatus,
        "PASS_VALIDATION_FAILED",
        "The AI response for this pass didn't match the expected format. No findings were saved — you can retry this pass.",
      );
    }

    const rowsToInsert = parsed.data.map((f) => {
      const overridden = applyReviewOverride({
        passType: data.passType,
        field: f.field,
        normalizedValue: f.normalized_value,
        confidence: f.confidence,
        source: f.source,
        reviewRequired: f.review_required,
        reviewReason: f.review_reason,
      });
      const findingKey = buildFindingKey(data.passType, f.field, overridden.source);
      return {
        finding_key: findingKey,
        analysis_run_id: run.id,
        owner_user_id: userId,
        passport_key: run.passport_key,
        document_id: run.document_id,
        pass_type: data.passType,
        field: f.field,
        normalized_value: overridden.normalizedValue,
        raw_value: f.raw_value,
        confidence: overridden.confidence,
        source: overridden.source,
        review_required: overridden.reviewRequired,
        review_reason: overridden.reviewReason,
        suggested_target: f.suggested_target,
        review_status: "PENDING",
      };
    });

    const seenKeys = new Set<string>();
    const deduped = rowsToInsert.filter((r) => {
      if (seenKeys.has(r.finding_key)) return false;
      seenKeys.add(r.finding_key);
      return true;
    });

    let insertedCount = 0;
    if (deduped.length > 0) {
      const { data: inserted, error: insertErr } = await (
        supabase.from("rights_analysis_findings" as never) as any
      )
        .upsert(deduped, { onConflict: "analysis_run_id,finding_key", ignoreDuplicates: true })
        .select("id");
      if (insertErr) throw new Error(insertErr.message);
      insertedCount = inserted?.length ?? 0;
    }

    const nextPassStatus = { ...passStatus, [data.passType]: "COMPLETE" };
    const nextRunStatus = recomputeRunStatus(nextPassStatus);
    await (supabase.from("rights_analysis_runs" as never) as any)
      .update({
        pass_status: nextPassStatus,
        status: nextRunStatus,
        completed_at:
          nextRunStatus === "COMPLETE" || nextRunStatus === "PARTIAL"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", run.id)
      .eq("owner_user_id", userId);

    if (nextRunStatus === "COMPLETE" || nextRunStatus === "PARTIAL") {
      await syncDocumentStatusAfterRun(supabase, userId, run.document_id, run.id);
    }

    return { ok: true, insertedCount, skippedCount: deduped.length - insertedCount };
  });

async function failPass(
  supabase: any,
  userId: string,
  run: AnalysisRunRow,
  passType: AnalysisPassType,
  passStatusBefore: Record<string, string>,
  errorCode: string,
  errorMessageSafe: string,
): Promise<RunPassResult> {
  const nextPassStatus = { ...passStatusBefore, [passType]: "FAILED" };
  await (supabase.from("rights_analysis_runs" as never) as any)
    .update({
      pass_status: nextPassStatus,
      status: recomputeRunStatus(nextPassStatus),
      error_code: errorCode,
    })
    .eq("id", run.id)
    .eq("owner_user_id", userId);
  return { ok: false, errorCode, errorMessageSafe };
}

async function syncDocumentStatusAfterRun(
  supabase: any,
  userId: string,
  documentId: string,
  runId: string,
): Promise<void> {
  const { data: pending } = await supabase
    .from("rights_analysis_findings" as never)
    .select("review_required" as never)
    .eq("analysis_run_id" as never, runId)
    .eq("owner_user_id" as never, userId)
    .eq("review_status" as never, "PENDING");
  const pendingRows = (pending ?? []) as unknown as { review_required: boolean }[];
  const anyHighImpactPending = pendingRows.some((r) => r.review_required);
  const status = anyHighImpactPending
    ? "REVIEW_REQUIRED"
    : pendingRows.length > 0
      ? "READY_FOR_REVIEW"
      : "READY_FOR_REVIEW";

  await (supabase.from("rights_passport_documents" as never) as any)
    .update({ status, analysis_status: "COMPLETE", analyzed_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("owner_user_id", userId);
}

// ---------------------------------------------------------------------------
// REVIEW QUEUE
// ---------------------------------------------------------------------------

export const listFindings = createServerFn({ method: "GET" })
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(input),
  )
  .middleware([requireRightsPassportAiEnabled, requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<FindingRow[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("rights_analysis_findings" as never)
      .select(FINDING_COLS as never)
      .eq("document_id" as never, data.documentId)
      .eq("owner_user_id" as never, userId)
      .order("created_at" as never, { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as FindingRow[];
  });

const REVIEW_ACTIONS = ["ACCEPT", "EDIT", "REJECT", "DEFER"] as const;

const reviewSchema = z.object({
  findingId: z.string().uuid(),
  action: z.enum(REVIEW_ACTIONS),
  editedValue: z.unknown().optional(),
  // Round 3.5 §D/§5: an existing, DIFFERENT AI consent value is never
  // silently overwritten — the caller must re-submit with this explicitly
  // true after the user has seen and confirmed the replacement.
  confirmOverwrite: z.boolean().optional(),
});

/** Thrown when an accept/edit would silently overwrite a differing, already-declared value — never auto-caught, always surfaced to the caller. */
export class ExistingValueConflictError extends Error {
  constructor(
    message: string,
    public readonly existingValue: unknown,
  ) {
    super(message);
    this.name = "ExistingValueConflictError";
  }
}

/**
 * Applies an ACCEPT/EDIT'd value to its structured target, if — and only
 * if — the target is one this codebase knows how to write safely. Today
 * that is exactly the AI Consent Builder mapping (spec's own worked
 * example: "Voice Clone = PROHIBIT -> AI Consent Builder / VOICE_CLONE /
 * PROHIBIT"). Any other suggested_target is left unapplied — the finding's
 * review_status still updates, but no other table is touched, rather than
 * guessing at a multi-field record (a License/Evidence row needs fields no
 * single finding carries, like `licensee` or `asset_id`) with fabricated
 * defaults.
 *
 * Round 3.5 hardening: if a consent already exists for this
 * (passport_key, asset_id, use_case) with a DIFFERENT permission than the
 * one being applied, the write is refused (ExistingValueConflictError)
 * unless confirmOverwrite=true — an existing, user-entered decision is
 * never silently replaced by a re-run or re-accepted finding.
 */
async function applyFindingToTarget(
  supabase: any,
  userId: string,
  finding: FindingRow,
  value: unknown,
  confirmOverwrite: boolean,
): Promise<{ appliedEntityType: string | null; appliedEntityId: string | null }> {
  const target = finding.suggested_target;
  if (!target || target.entity !== "ai_consent") {
    return { appliedEntityType: null, appliedEntityId: null };
  }
  const useCase = AI_FIELD_TO_USE_CASE[finding.field];
  if (!useCase) {
    return { appliedEntityType: null, appliedEntityId: null };
  }
  const permissionCheck = z.enum(AI_POLICIES).safeParse(value);
  if (!permissionCheck.success) {
    throw new Error(
      `This finding's value ("${String(value)}") isn't a recognized AI permission — edit it to one of: ${AI_POLICIES.join(", ")}.`,
    );
  }

  const { data: existing, error: existingErr } = await supabase
    .from("rights_ai_consents" as never)
    .select("id,permission" as never)
    .eq("passport_key" as never, finding.passport_key)
    .eq("owner_user_id" as never, userId)
    .is("asset_id" as never, null)
    .eq("use_case" as never, useCase)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  const existingRow = existing as unknown as { id: string; permission: string } | null;
  if (
    existingRow &&
    hasConflictingExistingValue(existingRow.permission, permissionCheck.data) &&
    !confirmOverwrite
  ) {
    throw new ExistingValueConflictError(
      `AI Consent for ${useCase} is already set to ${existingRow.permission}. Confirm you want to replace it with ${permissionCheck.data}.`,
      existingRow.permission,
    );
  }

  const { data: row, error } = await (supabase.from("rights_ai_consents" as never) as any)
    .upsert(
      {
        owner_user_id: userId,
        passport_key: finding.passport_key,
        asset_id: null,
        use_case: useCase,
        permission: permissionCheck.data,
        evidence_reference: finding.source
          ? `Analysis finding — document ${finding.document_id}, page ${(finding.source as any).page ?? "?"}`
          : null,
      },
      { onConflict: "passport_key,asset_id,use_case" },
    )
    .select("id")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Couldn't apply this finding to AI Consent");
  return { appliedEntityType: "ai_consent", appliedEntityId: row.id };
}

export const reviewFinding = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportAiEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ data, context }): Promise<FindingRow> => {
    const { supabase, userId } = context;
    const { data: findingRow, error: findErr } = await supabase
      .from("rights_analysis_findings" as never)
      .select(FINDING_COLS as never)
      .eq("id" as never, data.findingId)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!findingRow) throw new Error("Finding not found");
    const finding = findingRow as unknown as FindingRow;

    if (data.action === "EDIT" && data.editedValue === undefined) {
      throw new Error("editedValue is required for an EDIT action");
    }

    const patch: Record<string, unknown> = {
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    };

    if (data.action === "REJECT") {
      patch.review_status = "REJECTED";
      // No target write — rejected findings are retained (audit history)
      // but never applied.
    } else if (data.action === "DEFER") {
      patch.review_status = "DEFERRED";
    } else if (data.action === "ACCEPT") {
      patch.review_status = "ACCEPTED";
      const applied = await applyFindingToTarget(
        supabase,
        userId,
        finding,
        finding.normalized_value,
        data.confirmOverwrite ?? false,
      );
      patch.applied_entity_type = applied.appliedEntityType;
      patch.applied_entity_id = applied.appliedEntityId;
    } else if (data.action === "EDIT") {
      patch.review_status = "EDITED";
      patch.edited_value = data.editedValue;
      // EDIT always applies the user's corrected value, never the
      // original AI-suggested normalized_value.
      const applied = await applyFindingToTarget(
        supabase,
        userId,
        finding,
        data.editedValue,
        data.confirmOverwrite ?? false,
      );
      patch.applied_entity_type = applied.appliedEntityType;
      patch.applied_entity_id = applied.appliedEntityId;
    }

    const { data: row, error } = await (supabase.from("rights_analysis_findings" as never) as any)
      .update(patch)
      .eq("id", data.findingId)
      .eq("owner_user_id", userId)
      .select(FINDING_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Finding not found");
    return row;
  });
