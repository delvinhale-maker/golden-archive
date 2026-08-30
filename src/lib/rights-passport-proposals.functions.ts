/**
 * AurumVault Digital Rights Passport Generator — Round 3.5 structured
 * proposal server functions: the missing bridge between Round 3's review
 * queue and Round 1/2's structured passport tables for the GROUPED
 * proposal families (ASSET, LICENSE, EVIDENCE, PROFILE_UPDATE).
 *
 * AI_CONSENT proposals stay on Round 3's existing (now Round-3.5-hardened)
 * reviewFinding path in rights-passport-analysis.functions.ts — that
 * mapping was already correct and 1:1 with a single finding; nothing here
 * duplicates it. This file exists for the families that genuinely need
 * multi-finding assembly and a target-entity type reviewFinding never
 * supported (asset creation/matching, license/evidence creation, passport
 * profile updates).
 *
 * SEARCH FIRST: no new table. listProposals derives StructuredProposal
 * objects fresh from rights_analysis_findings on every call (via the pure
 * rights-passport-proposal-assembly.ts). applyProposal's only persistent
 * state is on the findings themselves (review_status, edited_value,
 * applied_entity_type, applied_entity_id) plus whatever structured row it
 * creates/updates — see the IDEMPOTENCY note on applyProposal.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRightsPassportEnabled } from "@/lib/rights-passport-feature-flags.middleware";
import {
  CONTROL_BASES,
  ASSET_TYPES,
  ASSET_COLS,
  PASSPORT_COLS,
  type AssetRow,
  type PassportRow,
} from "@/lib/rights-passport.schema";
import {
  LICENSE_PERMISSION_TYPES,
  LICENSE_COLS,
  EVIDENCE_TYPES,
  EVIDENCE_COLS,
} from "@/lib/rights-passport-workspace.schema";
import { getDocumentInternal } from "@/lib/rights-passport-documents.functions";
import { FINDING_COLS, type FindingRow } from "@/lib/rights-passport-analysis-schema";
import {
  assembleProposals,
  hasConflictingExistingValue,
  PROPOSAL_TYPES,
  type StructuredProposal,
  type AssemblyFinding,
} from "@/lib/rights-passport-proposal-assembly";
import { reconcileReviewFlagsForPassportKey } from "@/lib/rights-passport-review.functions";

function toAssemblyFinding(f: FindingRow): AssemblyFinding {
  return {
    id: f.id,
    passType: f.pass_type,
    field: f.field,
    normalizedValue: f.normalized_value,
    rawValue: f.raw_value,
    source: f.source,
    reviewStatus: f.review_status as AssemblyFinding["reviewStatus"],
  };
}

async function fetchDocumentFindings(
  supabase: any,
  userId: string,
  documentId: string,
): Promise<FindingRow[]> {
  const { data: rows, error } = await supabase
    .from("rights_analysis_findings" as never)
    .select(FINDING_COLS as never)
    .eq("document_id" as never, documentId)
    .eq("owner_user_id" as never, userId);
  if (error) throw new Error(error.message);
  return (rows ?? []) as unknown as FindingRow[];
}

// ---------------------------------------------------------------------------
// listProposals
// ---------------------------------------------------------------------------

const listSchema = z.object({ documentId: z.string().uuid() });

export type ListedProposal = StructuredProposal & {
  existingValue: unknown;
};

export const listProposals = createServerFn({ method: "GET" })
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data, context }): Promise<ListedProposal[]> => {
    const { supabase, userId } = context;
    const doc = await getDocumentInternal(supabase, userId, data.documentId);
    const findings = await fetchDocumentFindings(supabase, userId, doc.id);
    const proposals = assembleProposals(
      doc.id,
      doc.original_file_name,
      findings.map(toAssemblyFinding),
    );
    // Only the grouped families this file applies are returned here —
    // AI_CONSENT proposals are still shown in the Round 3 individual
    // finding queue via listFindings/reviewFinding.
    const grouped = proposals.filter((p) => p.proposalType !== "AI_CONSENT");
    if (grouped.length === 0) return [];

    const { data: passportRow } = await supabase
      .from("rights_passports" as never)
      .select(PASSPORT_COLS as never)
      .eq("passport_key" as never, doc.passport_key)
      .eq("owner_user_id" as never, userId)
      .order("version" as never, { ascending: false })
      .limit(1)
      .maybeSingle();
    const passport = passportRow as unknown as PassportRow | null;

    return grouped.map((p) => {
      let existingValue: unknown = null;
      if (p.proposalType === "PROFILE_UPDATE" && passport) {
        const field = (p.proposedRecord as { field: string }).field;
        const column = field === "jurisdiction" ? "jurisdiction" : "effective_date";
        existingValue = (passport as unknown as Record<string, unknown>)[column] ?? null;
      }
      return { ...p, existingValue };
    });
  });

// ---------------------------------------------------------------------------
// applyProposal
// ---------------------------------------------------------------------------

const assetSelectionSchema = z
  .discriminatedUnion("mode", [
    z.object({ mode: z.literal("CREATE_NEW") }),
    z.object({ mode: z.literal("MATCH_EXISTING"), assetId: z.string().uuid() }),
  ])
  .optional();

const applyProposalSchema = z.object({
  documentId: z.string().uuid(),
  proposalType: z.enum(PROPOSAL_TYPES),
  sourceFindingIds: z.array(z.string().uuid()).min(1),
  action: z.enum(["ACCEPT", "REJECT", "DEFER"]),
  editedRecord: z.record(z.string(), z.unknown()).optional(),
  confirmHighImpact: z.boolean().optional(),
  confirmOverwrite: z.boolean().optional(),
  assetSelection: assetSelectionSchema,
});

export type ApplyProposalResult = {
  status: "APPLIED" | "REJECTED" | "DEFERRED" | "ALREADY_APPLIED";
  appliedEntityType: string | null;
  appliedEntityId: string | null;
};

async function stampFindings(
  supabase: any,
  userId: string,
  documentId: string,
  findingIds: string[],
  reviewStatus: "ACCEPTED" | "EDITED" | "REJECTED" | "DEFERRED",
  appliedEntityType: string | null,
  appliedEntityId: string | null,
): Promise<void> {
  const { error } = await (supabase.from("rights_analysis_findings" as never) as any)
    .update({
      review_status: reviewStatus,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      applied_entity_type: appliedEntityType,
      applied_entity_id: appliedEntityId,
    })
    .in("id", findingIds)
    .eq("owner_user_id", userId)
    .eq("document_id", documentId);
  if (error) throw new Error(error.message);
}

async function assertAssetOwnership(
  supabase: any,
  userId: string,
  passportKey: string,
  assetId: string,
): Promise<AssetRow> {
  const { data, error } = await supabase
    .from("rights_passport_assets" as never)
    .select(ASSET_COLS as never)
    .eq("id" as never, assetId)
    .eq("passport_key" as never, passportKey)
    .eq("owner_user_id" as never, userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Target asset not found — it must belong to this passport.");
  return data as unknown as AssetRow;
}

export const applyProposal = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => applyProposalSchema.parse(input))
  .handler(async ({ data, context }): Promise<ApplyProposalResult> => {
    const { supabase, userId } = context;
    const doc = await getDocumentInternal(supabase, userId, data.documentId);

    // Every source finding is re-verified here — scoped by id, owner_user_id,
    // AND document_id — so a finding from a different document (and
    // therefore, structurally, a different passport) can never be smuggled
    // into this proposal (Round 3.5 §J: "Prevent a finding from passport A
    // from being applied to passport B").
    const { data: findingRows, error: findErr } = await supabase
      .from("rights_analysis_findings" as never)
      .select(FINDING_COLS as never)
      .in("id" as never, data.sourceFindingIds)
      .eq("owner_user_id" as never, userId)
      .eq("document_id" as never, doc.id);
    if (findErr) throw new Error(findErr.message);
    const findings = (findingRows ?? []) as unknown as FindingRow[];
    if (findings.length !== data.sourceFindingIds.length) {
      throw new Error(
        "One or more findings in this proposal could not be verified for this document.",
      );
    }

    if (data.action === "REJECT") {
      await stampFindings(supabase, userId, doc.id, data.sourceFindingIds, "REJECTED", null, null);
      return { status: "REJECTED", appliedEntityType: null, appliedEntityId: null };
    }
    if (data.action === "DEFER") {
      await stampFindings(supabase, userId, doc.id, data.sourceFindingIds, "DEFERRED", null, null);
      return { status: "DEFERRED", appliedEntityType: null, appliedEntityId: null };
    }

    // IDEMPOTENCY: if every constituent finding already points at the same
    // applied entity, this exact proposal was already applied — return the
    // existing target instead of writing again (safe network retry).
    const appliedIds = new Set(findings.map((f) => f.applied_entity_id).filter(Boolean));
    const appliedTypes = new Set(findings.map((f) => f.applied_entity_type).filter(Boolean));
    if (
      findings.every((f) => f.applied_entity_id) &&
      appliedIds.size === 1 &&
      appliedTypes.size === 1
    ) {
      return {
        status: "ALREADY_APPLIED",
        appliedEntityType: findings[0].applied_entity_type,
        appliedEntityId: findings[0].applied_entity_id,
      };
    }

    // Recompute the canonical proposal server-side — never trust a
    // client-supplied proposedRecord wholesale. editedRecord is applied as
    // an explicit override layer on top of it (the actual EDIT).
    const [recomputed] = assembleProposals(
      doc.id,
      doc.original_file_name,
      findings.map(toAssemblyFinding),
    ).filter((p) => p.proposalType === data.proposalType);
    if (!recomputed) {
      throw new Error(
        "These findings no longer assemble into a valid proposal — they may have already been decided.",
      );
    }
    const record: Record<string, unknown> = {
      ...recomputed.proposedRecord,
      ...(data.editedRecord ?? {}),
    };
    const isEdited = !!data.editedRecord && Object.keys(data.editedRecord).length > 0;
    const reviewStatus = isEdited ? "EDITED" : "ACCEPTED";

    if (recomputed.requiresHighImpactConfirmation && !data.confirmHighImpact) {
      throw new Error(
        "This is a high-impact rights finding. Confirm that you want this information recorded in your Digital Rights Passport. Recording it does not determine legal ownership or enforceability.",
      );
    }

    let appliedEntityType: string;
    let appliedEntityId: string;

    if (data.proposalType === "ASSET") {
      const controlBasis = z.enum(CONTROL_BASES).safeParse(record.controlBasis).success
        ? (record.controlBasis as (typeof CONTROL_BASES)[number])
        : "REVIEW_REQUIRED";
      const assetType = z.enum(ASSET_TYPES).safeParse(record.assetType).success
        ? record.assetType
        : "OTHER";
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) throw new Error("An asset name is required — edit the proposal before accepting.");

      if (data.assetSelection?.mode === "MATCH_EXISTING") {
        const existing = await assertAssetOwnership(
          supabase,
          userId,
          doc.passport_key,
          data.assetSelection.assetId,
        );
        const { data: row, error } = await (supabase.from("rights_passport_assets" as never) as any)
          .update({
            name,
            asset_type: assetType,
            claimed_owner_controller:
              record.claimedOwnerController ?? existing.claimed_owner_controller,
            control_basis: controlBasis,
            territory: record.territory ?? existing.territory,
            description: record.description ?? existing.description,
          })
          .eq("id", existing.id)
          .eq("owner_user_id", userId)
          .select("id")
          .single();
        if (error || !row) throw new Error(error?.message ?? "Couldn't update the matched asset");
        appliedEntityType = "asset";
        appliedEntityId = row.id;
      } else {
        const { data: row, error } = await (supabase.from("rights_passport_assets" as never) as any)
          .insert({
            owner_user_id: userId,
            passport_key: doc.passport_key,
            name,
            asset_type: assetType,
            claimed_owner_controller: record.claimedOwnerController ?? null,
            control_basis: controlBasis,
            territory: record.territory ?? null,
            description: record.description ?? null,
            status: "REVIEW_REQUIRED",
          })
          .select("id")
          .single();
        if (error || !row) throw new Error(error?.message ?? "Couldn't create asset");
        appliedEntityType = "asset";
        appliedEntityId = row.id;
      }
    } else if (data.proposalType === "LICENSE") {
      if (data.assetSelection?.mode !== "MATCH_EXISTING") {
        throw new Error("Select the asset this license applies to before accepting.");
      }
      const asset = await assertAssetOwnership(
        supabase,
        userId,
        doc.passport_key,
        data.assetSelection.assetId,
      );
      const licensee = typeof record.licensee === "string" ? record.licensee.trim() : "";
      if (!licensee)
        throw new Error("A licensee is required — edit the proposal before accepting.");
      const permissionType = z.enum(LICENSE_PERMISSION_TYPES).safeParse(record.permissionType)
        .success
        ? record.permissionType
        : "LICENSE";

      const { data: row, error } = await (supabase.from("rights_licenses" as never) as any)
        .insert({
          owner_user_id: userId,
          passport_key: doc.passport_key,
          asset_id: asset.id,
          licensee,
          exact_use: record.exactUse ?? null,
          permission_type: permissionType,
          start_date: record.startDate ?? null,
          end_date: record.endDate ?? null,
          territory: record.territory ?? null,
          is_exclusive: record.isExclusive === true,
          ai_synthetic_rights_included: record.aiSyntheticRightsIncluded ?? null,
          compensation: record.compensation ?? null,
          controlling_document_reference: record.controllingDocumentReference ?? null,
          // Never ACTIVE at creation, regardless of editedRecord — user
          // must explicitly confirm activation later (Round 3.5 §2).
          status: "REVIEW_REQUIRED",
          notes: `Assembled from AI analysis of document ${doc.id}.`,
        })
        .select("id")
        .single();
      if (error || !row) throw new Error(error?.message ?? "Couldn't create license");
      appliedEntityType = "license";
      appliedEntityId = row.id;
    } else if (data.proposalType === "EVIDENCE") {
      if (data.assetSelection?.mode !== "MATCH_EXISTING") {
        throw new Error("Select the asset this evidence supports before accepting.");
      }
      const asset = await assertAssetOwnership(
        supabase,
        userId,
        doc.passport_key,
        data.assetSelection.assetId,
      );
      const evidenceType = z.enum(EVIDENCE_TYPES).safeParse(record.evidenceType).success
        ? record.evidenceType
        : "OTHER";
      const REVIEW_REQUIRED_TYPES = new Set([
        "COPYRIGHT_REGISTRATION",
        "TRADEMARK_REGISTRATION",
        "MODEL_TALENT_RELEASE",
        "SPLIT_OWNERSHIP_RECORD",
        "IDENTITY_DOCUMENT",
      ]);
      // Never VERIFIED from AI-assisted creation alone — always
      // SELF_DECLARED or REVIEW_REQUIRED (Round 3.5 §3).
      const status = REVIEW_REQUIRED_TYPES.has(evidenceType as string)
        ? "REVIEW_REQUIRED"
        : "SELF_DECLARED";

      const { data: row, error } = await (supabase.from("rights_evidence" as never) as any)
        .insert({
          owner_user_id: userId,
          passport_key: doc.passport_key,
          asset_id: asset.id,
          evidence_type: evidenceType,
          source_creator: record.sourceCreator ?? null,
          issued_date: record.issuedDate ?? null,
          has_content_credential: false,
          status,
          notes: record.notes ?? null,
        })
        .select("id")
        .single();
      if (error || !row) throw new Error(error?.message ?? "Couldn't create evidence record");
      appliedEntityType = "evidence";
      appliedEntityId = row.id;
    } else if (data.proposalType === "PROFILE_UPDATE") {
      const field = record.field as string;
      const column = field === "jurisdiction" ? "jurisdiction" : "effective_date";
      const newValue = record.suggestedValue;

      const { data: passportRow, error: passportErr } = await supabase
        .from("rights_passports" as never)
        .select(PASSPORT_COLS as never)
        .eq("passport_key" as never, doc.passport_key)
        .eq("owner_user_id" as never, userId)
        .order("version" as never, { ascending: false })
        .limit(1)
        .maybeSingle();
      if (passportErr) throw new Error(passportErr.message);
      const passport = passportRow as unknown as PassportRow | null;
      if (!passport) throw new Error("Passport not found");

      const currentValue = (passport as unknown as Record<string, unknown>)[column];
      if (hasConflictingExistingValue(currentValue, newValue) && !data.confirmOverwrite) {
        throw new Error(
          `Your passport already has a value for this field ("${String(currentValue)}"). Confirm you want to replace it with "${String(newValue)}".`,
        );
      }

      const { data: row, error } = await (supabase.from("rights_passports" as never) as any)
        .update({ [column]: newValue })
        .eq("id", passport.id)
        .eq("owner_user_id", userId)
        .select("id")
        .single();
      if (error || !row) throw new Error(error?.message ?? "Couldn't update passport profile");
      appliedEntityType = "passport";
      appliedEntityId = row.id;
    } else {
      throw new Error(
        `Proposal type ${data.proposalType} is not handled by applyProposal — see reviewFinding for AI_CONSENT.`,
      );
    }

    await stampFindings(
      supabase,
      userId,
      doc.id,
      data.sourceFindingIds,
      reviewStatus,
      appliedEntityType,
      appliedEntityId,
    );
    await reconcileReviewFlagsForPassportKey(supabase, userId, doc.passport_key);

    return { status: "APPLIED", appliedEntityType, appliedEntityId };
  });
