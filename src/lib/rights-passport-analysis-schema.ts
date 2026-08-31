/**
 * AurumVault Digital Rights Passport Generator — Round 3 multi-pass AI
 * extraction schema.
 *
 * MULTI-PASS, not one giant schema: each pass has its own field catalog and
 * its own Zod validator for the model's raw output, so a malformed response
 * in one pass never contaminates the others (see rights-passport-analysis
 * .functions.ts's per-pass retry handling). Every field maps to a
 * `pass_type` from the DB enum (rights_analysis_pass_type).
 *
 * AI_SYNTHETIC_RIGHTS fields deliberately mirror Round 2's AI_USE_CASES
 * (rights-passport-workspace.schema.ts) via AI_FIELD_TO_USE_CASE — an
 * accepted AI_SYNTHETIC_RIGHTS finding maps directly onto an AI Consent
 * Builder use_case, never a re-derived/guessed one.
 *
 * SAFETY: a finding's normalized_value is model output, not a verified
 * fact — Zod validation here only checks the SHAPE is well-formed and the
 * field is a recognized one. It does not and cannot verify the finding's
 * truth; that is exactly why the review-queue accept/edit/reject workflow
 * exists (rights-passport-analysis.functions.ts).
 */
import { z } from "zod";
import type { JsonValue } from "@/lib/rights-passport-json";

export const ANALYSIS_PASS_TYPES = [
  "DOCUMENT_STRUCTURE",
  "RIGHTS_GRANT",
  "AI_SYNTHETIC_RIGHTS",
  "COMMERCIAL_TERMS",
  "RISK_CONFLICT_SIGNALS",
] as const;
export type AnalysisPassType = (typeof ANALYSIS_PASS_TYPES)[number];

export const PASS_LABELS: Record<AnalysisPassType, string> = {
  DOCUMENT_STRUCTURE: "Document Structure",
  RIGHTS_GRANT: "Rights Grant",
  AI_SYNTHETIC_RIGHTS: "AI & Synthetic Rights",
  COMMERCIAL_TERMS: "Commercial Terms",
  RISK_CONFLICT_SIGNALS: "Risk & Conflict Signals",
};

export const DOCUMENT_STRUCTURE_FIELDS = [
  "agreement_type",
  "parties",
  "effective_date",
  "execution_date",
  "term",
  "renewal",
  "territory",
  "governing_law",
  "defined_terms",
  "document_sections",
] as const;

export const RIGHTS_GRANT_FIELDS = [
  "ownership_language",
  "licenses_granted",
  "rights_reserved",
  "exclusivity",
  "sublicensing",
  "assignment",
  "derivative_rights",
  "media",
  "platforms",
  "territory",
  "duration",
  "revocation",
  "termination",
  "post_term_rights",
] as const;

export const AI_SYNTHETIC_RIGHTS_FIELDS = [
  "ai_training",
  "fine_tuning",
  "embeddings_retrieval",
  "voice_cloning",
  "synthetic_voice",
  "likeness_generation",
  "digital_replica",
  "synthetic_video",
  "avatars",
  "generated_advertising",
  "personalized_content",
  "derivative_ai_output",
  "model_retention",
  "derived_model_retention",
  "posthumous_use",
] as const;

/** Maps an AI_SYNTHETIC_RIGHTS finding field to the Round 2 AI Consent Builder use_case it corresponds to. */
export const AI_FIELD_TO_USE_CASE: Record<string, string> = {
  ai_training: "GENERAL_AI_TRAINING",
  fine_tuning: "FINE_TUNING_CUSTOM_MODEL",
  embeddings_retrieval: "EMBEDDING_RETRIEVAL",
  voice_cloning: "VOICE_CLONE",
  synthetic_voice: "SYNTHETIC_VOICE",
  likeness_generation: "FACE_LIKENESS_GENERATION",
  digital_replica: "DIGITAL_REPLICA",
  synthetic_video: "SYNTHETIC_VIDEO",
  avatars: "AVATAR_VIRTUAL_HUMAN",
  generated_advertising: "GENERATED_ADVERTISEMENT",
  personalized_content: "PERSONALIZED_CONTENT",
  derivative_ai_output: "AI_REMIX_DERIVATIVE",
  posthumous_use: "POSTHUMOUS_ESTATE_USE",
  // model_retention / derived_model_retention map to ai_consent BOOLEAN
  // columns (model_retention_allowed / derived_model_allowed), not a
  // use_case — handled separately in the accept-mapping logic.
};

export const COMMERCIAL_TERMS_FIELDS = [
  "compensation",
  "royalty",
  "fee",
  "payment_schedule",
  "minimum_guarantee",
  "audit_rights",
  "approval_rights",
  "consent_rights",
  "usage_approvals",
  "attribution",
  "reporting",
  "renewal_economics",
  "termination_economics",
] as const;

export const RISK_CONFLICT_SIGNALS_FIELDS = [
  "perpetual_rights",
  "irrevocable_rights",
  "broad_assignment",
  "unlimited_sublicensing",
  "broad_exclusivity",
  "unclear_territory",
  "no_termination",
  "post_term_survival",
  "ai_rights_bundled_into_general_rights",
  "voice_likeness_without_limits",
  "conflict_with_passport_defaults",
  "conflict_with_active_license",
  "unclear_ownership",
  "co_owner_dependency",
  "representative_authority_issue",
  "team_league_label_studio_restriction",
  "contradictory_clauses",
  "governing_law_conflict",
] as const;

export const PASS_FIELDS: Record<AnalysisPassType, readonly string[]> = {
  DOCUMENT_STRUCTURE: DOCUMENT_STRUCTURE_FIELDS,
  RIGHTS_GRANT: RIGHTS_GRANT_FIELDS,
  AI_SYNTHETIC_RIGHTS: AI_SYNTHETIC_RIGHTS_FIELDS,
  COMMERCIAL_TERMS: COMMERCIAL_TERMS_FIELDS,
  RISK_CONFLICT_SIGNALS: RISK_CONFLICT_SIGNALS_FIELDS,
};

/**
 * High-impact (pass, field) pairs — forced review_required=true regardless
 * of model confidence (Round 3 spec §7). Kept as a flat "PASS::field" string
 * set so rights-passport-analysis-confidence.ts (pure, dependency-free) can
 * duplicate just the list, not this whole zod-importing module.
 */
export const HIGH_IMPACT_FIELD_KEYS = [
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
] as const;

export const SUGGESTED_TARGET_ENTITIES = [
  "ai_consent",
  "license",
  "evidence",
  "asset",
  "passport",
] as const;
export type SuggestedTargetEntity = (typeof SUGGESTED_TARGET_ENTITIES)[number];

const findingSourceSchema = z
  .object({
    document_id: z.string().uuid(),
    page: z.number().int().positive().nullable(),
    section: z.string().max(200).nullable(),
    quote: z.string().max(1000),
  })
  .nullable();

const suggestedTargetSchema = z
  .object({
    entity: z.enum(SUGGESTED_TARGET_ENTITIES),
    field: z.string().max(100),
  })
  .nullable();

/** Builds the Zod schema the model's raw JSON output for one pass must satisfy. */
export function modelFindingSchema(passType: AnalysisPassType) {
  const fields = PASS_FIELDS[passType];
  return z.object({
    field: z.enum(fields as [string, ...string[]]),
    normalized_value: z.unknown().nullable(),
    raw_value: z.string().max(2000).nullable(),
    confidence: z.number().min(0).max(1),
    source: findingSourceSchema,
    review_required: z.boolean(),
    review_reason: z.string().max(500).nullable(),
    suggested_target: suggestedTargetSchema,
  });
}

export function modelPassOutputSchema(passType: AnalysisPassType) {
  return z.array(modelFindingSchema(passType)).max(50);
}

export type ModelFinding = z.infer<ReturnType<typeof modelFindingSchema>>;

export const CONFIDENCE_BANDS = ["HIGH", "MODERATE", "LOW"] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

export const CONFIDENCE_BAND_LABELS: Record<ConfidenceBand, string> = {
  HIGH: "High extraction confidence",
  MODERATE: "Moderate extraction confidence",
  LOW: "Low extraction confidence",
};

export const FINDING_REVIEW_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "EDITED",
  "REJECTED",
  "DEFERRED",
] as const;
export type FindingReviewStatus = (typeof FINDING_REVIEW_STATUSES)[number];

export type FindingRow = {
  id: string;
  analysis_run_id: string;
  passport_key: string;
  document_id: string;
  finding_key: string;
  pass_type: AnalysisPassType;
  field: string;
  normalized_value: JsonValue;
  raw_value: string | null;
  confidence: number;
  source: {
    document_id: string;
    page: number | null;
    section: string | null;
    quote: string;
  } | null;
  review_required: boolean;
  review_reason: string | null;
  suggested_target: { entity: SuggestedTargetEntity; field: string } | null;
  review_status: FindingReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  edited_value: unknown;
  applied_entity_type: string | null;
  applied_entity_id: string | null;
  created_at: string;
  updated_at: string;
};

export const FINDING_COLS =
  "id,analysis_run_id,passport_key,document_id,finding_key,pass_type,field,normalized_value,raw_value,confidence,source,review_required,review_reason,suggested_target,review_status,reviewed_by,reviewed_at,edited_value,applied_entity_type,applied_entity_id,created_at,updated_at";

export const ANALYSIS_RUN_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETE",
  "PARTIAL",
  "FAILED",
] as const;
export type AnalysisRunStatus = (typeof ANALYSIS_RUN_STATUSES)[number];

export const PASS_EXECUTION_STATUSES = ["PENDING", "RUNNING", "COMPLETE", "FAILED"] as const;
export type PassExecutionStatus = (typeof PASS_EXECUTION_STATUSES)[number];

export type AnalysisRunRow = {
  id: string;
  passport_key: string;
  document_id: string;
  status: AnalysisRunStatus;
  pass_status: Partial<Record<AnalysisPassType, PassExecutionStatus>>;
  model: string | null;
  provider: string;
  schema_version: string;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

export const ANALYSIS_RUN_COLS =
  "id,passport_key,document_id,status,pass_status,model,provider,schema_version,started_at,completed_at,error_code,created_at,updated_at";

export const AI_ANALYSIS_DISCLAIMER =
  "AI analysis identifies possible rights, terms, and risks from the uploaded document. It is not a legal opinion. Review all findings before adding them to your Digital Rights Passport.";

export const HIGH_IMPACT_REVIEW_NOTE = "Professional review may be appropriate.";
