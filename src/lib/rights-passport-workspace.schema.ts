/**
 * AurumVault Digital Rights Passport Generator — Round 2 rights-control
 * workspace: shared enums, types, and Zod validators for AI Consent,
 * License Register, Evidence Register, and Risk & Conflict Review.
 *
 * Kept separate from rights-passport.schema.ts (Round 1) rather than
 * appended to it, for the same reason that file gave for existing as its
 * own module: this is a large, independently-reusable slice. `permission`
 * reuses Round 1's AI_POLICIES/AiPolicy directly (not redefined here) —
 * it's the exact same six-value enum at the database layer
 * (public.rights_permission), and the risk engine needs to compare an
 * asset's default_ai_policy against a consent row's permission directly,
 * which only works cleanly if they're actually the same type.
 *
 * SAFETY: no permission ever defaults to ALLOW — every Zod schema below
 * requires an explicit value. An undeclared use case simply has no row at
 * all, which the UI renders as "NOT DECLARED," never as an implicit grant.
 */
import { z } from "zod";
import { AI_POLICIES, type AiPolicy } from "@/lib/rights-passport.schema";

export const AI_USE_CASES = [
  "GENERAL_AI_TRAINING",
  "FINE_TUNING_CUSTOM_MODEL",
  "EMBEDDING_RETRIEVAL",
  "VOICE_CLONE",
  "SYNTHETIC_VOICE",
  "DIGITAL_REPLICA",
  "FACE_LIKENESS_GENERATION",
  "SYNTHETIC_VIDEO",
  "MOTION_PERFORMANCE_SIMULATION",
  "AVATAR_VIRTUAL_HUMAN",
  "GAME_CHARACTER",
  "GENERATED_ADVERTISEMENT",
  "PERSONALIZED_CONTENT",
  "STYLE_PERSONA_SIMULATION",
  "TRANSLATION_DUBBING",
  "AI_REMIX_DERIVATIVE",
  "PROMPT_DATASET_EXAMPLE",
  "BENCHMARK_EVALUATION",
  "SEARCH_DISCOVERY_INDEXING",
  "COMMERCIAL_MODEL_OUTPUT",
  "NONCOMMERCIAL_RESEARCH",
  "POSTHUMOUS_ESTATE_USE",
] as const;
export type AiUseCase = (typeof AI_USE_CASES)[number];

/** Plain-language explanation for a nontechnical user — no legal conclusions. */
export const AI_USE_CASE_COPY: Record<AiUseCase, { label: string; description: string }> = {
  GENERAL_AI_TRAINING: {
    label: "General AI Training",
    description: "Controls whether your work may be used to train general-purpose AI models.",
  },
  FINE_TUNING_CUSTOM_MODEL: {
    label: "Fine-Tuning a Custom Model",
    description: "Controls whether your work may be used to fine-tune a specific, custom AI model.",
  },
  EMBEDDING_RETRIEVAL: {
    label: "Embedding / Retrieval",
    description: "Controls whether your work may be indexed for AI search or retrieval systems.",
  },
  VOICE_CLONE: {
    label: "Voice Clone",
    description: "Controls whether an AI system may generate new speech that sounds like you.",
  },
  SYNTHETIC_VOICE: {
    label: "Synthetic Voice",
    description: "Controls whether a synthetic voice modeled on yours may be used more broadly.",
  },
  DIGITAL_REPLICA: {
    label: "Digital Replica",
    description:
      "Controls whether a synthetic version of your appearance, voice, or performance may be created.",
  },
  FACE_LIKENESS_GENERATION: {
    label: "Face / Likeness Generation",
    description: "Controls whether AI may generate new images of your face or likeness.",
  },
  SYNTHETIC_VIDEO: {
    label: "Synthetic Video",
    description: "Controls whether AI-generated video featuring you may be created.",
  },
  MOTION_PERFORMANCE_SIMULATION: {
    label: "Motion / Performance Simulation",
    description: "Controls whether your movement or performance style may be simulated by AI.",
  },
  AVATAR_VIRTUAL_HUMAN: {
    label: "Avatar / Virtual Human",
    description: "Controls whether a virtual avatar based on you may be created and used.",
  },
  GAME_CHARACTER: {
    label: "Game Character",
    description: "Controls whether you may be represented as a character in a video game.",
  },
  GENERATED_ADVERTISEMENT: {
    label: "Generated Advertisement",
    description: "Controls whether AI-generated advertising may feature your likeness or work.",
  },
  PERSONALIZED_CONTENT: {
    label: "Personalized Content",
    description:
      "Controls whether your work may be used to generate personalized content for others.",
  },
  STYLE_PERSONA_SIMULATION: {
    label: "Style / Persona Simulation",
    description: "Controls whether your creative style or persona may be simulated by AI.",
  },
  TRANSLATION_DUBBING: {
    label: "Translation / Dubbing",
    description: "Controls whether your voice or work may be translated or dubbed using AI.",
  },
  AI_REMIX_DERIVATIVE: {
    label: "AI Remix / Derivative",
    description: "Controls whether AI may create remixes or derivative works from yours.",
  },
  PROMPT_DATASET_EXAMPLE: {
    label: "Prompt / Dataset Example",
    description: "Controls whether your work may be included as an example in a training dataset.",
  },
  BENCHMARK_EVALUATION: {
    label: "Benchmark / Evaluation",
    description:
      "Controls whether your work may be used to test or evaluate AI system performance.",
  },
  SEARCH_DISCOVERY_INDEXING: {
    label: "Search / Discovery Indexing",
    description: "Controls whether your work may be indexed for AI-powered search or discovery.",
  },
  COMMERCIAL_MODEL_OUTPUT: {
    label: "Commercial Model Output",
    description: "Controls whether AI systems may generate commercial output based on your work.",
  },
  NONCOMMERCIAL_RESEARCH: {
    label: "Noncommercial Research",
    description: "Controls whether your work may be used for noncommercial AI research.",
  },
  POSTHUMOUS_ESTATE_USE: {
    label: "Posthumous / Estate Use",
    description:
      "Controls how AI may use your identity or work after death, on your estate's behalf.",
  },
};

/** Surfaced with extra emphasis in the AI Consent Builder and the risk engine. */
export const HIGH_RISK_AI_USE_CASES: AiUseCase[] = [
  "VOICE_CLONE",
  "DIGITAL_REPLICA",
  "GENERATED_ADVERTISEMENT",
  "COMMERCIAL_MODEL_OUTPUT",
  "POSTHUMOUS_ESTATE_USE",
];

export { AI_POLICIES as PERMISSION_VALUES, type AiPolicy as Permission };

export const PERMISSION_LABELS: Record<AiPolicy, string> = {
  ALLOW: "Allow",
  ALLOW_WITH_TERMS: "Allow with terms",
  PROHIBIT: "Prohibit",
  CASE_BY_CASE: "Case by case",
  CONTACT_FOR_LICENSE: "Contact for license",
  REVIEW_REQUIRED: "Review required",
};

export const LICENSE_PERMISSION_TYPES = [
  "LICENSE",
  "CONSENT",
  "WAIVER",
  "ASSIGNMENT",
  "SERVICE_AGREEMENT",
  "PLATFORM_TERMS",
  "OTHER",
] as const;
export type LicensePermissionType = (typeof LICENSE_PERMISSION_TYPES)[number];

export const LICENSE_STATUSES = [
  "ACTIVE",
  "PENDING",
  "EXPIRED",
  "REVOKED",
  "SUPERSEDED",
  "REVIEW_REQUIRED",
] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const EVIDENCE_TYPES = [
  "SOURCE_FILE",
  "CONTRACT",
  "COPYRIGHT_REGISTRATION",
  "TRADEMARK_REGISTRATION",
  "MODEL_TALENT_RELEASE",
  "SPLIT_OWNERSHIP_RECORD",
  "IDENTITY_DOCUMENT",
  "CONTENT_CREDENTIAL",
  "HASH",
  "PUBLICATION_RECORD",
  "TIMESTAMP",
  "OTHER",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_STATUSES = [
  "VERIFIED",
  "SELF_DECLARED",
  "PENDING",
  "DISPUTED",
  "EXPIRED",
  "REVIEW_REQUIRED",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const FLAG_SEVERITIES = ["CRITICAL", "HIGH", "MODERATE", "LOW"] as const;
export type FlagSeverity = (typeof FLAG_SEVERITIES)[number];

export const FLAG_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "ACCEPTED_RISK"] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

export const FLAG_ENTITY_TYPES = [
  "passport",
  "asset",
  "ai_consent",
  "license",
  "evidence",
] as const;
export type FlagEntityType = (typeof FLAG_ENTITY_TYPES)[number];

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

// ---- AI Consent ----
export const aiConsentUpsertSchema = z.object({
  assetId: z.string().uuid().nullable().optional(),
  useCase: z.enum(AI_USE_CASES),
  permission: z.enum(AI_POLICIES),
  compensationRule: optionalText(500),
  separateWrittenConsentRequired: z.boolean().optional(),
  humanOutputApprovalRequired: z.boolean().optional(),
  attributionRequired: z.boolean().optional(),
  modelRetentionAllowed: z.boolean().optional(),
  derivedModelAllowed: z.boolean().optional(),
  term: optionalText(200),
  territory: optionalText(120),
  revocationRule: optionalText(500),
  licenseContact: optionalText(200),
  evidenceReference: optionalText(500),
  notes: optionalText(2000),
});
export type AiConsentUpsertInput = z.infer<typeof aiConsentUpsertSchema>;

export type AiConsentRow = {
  id: string;
  passport_key: string;
  asset_id: string | null;
  use_case: AiUseCase;
  permission: AiPolicy;
  compensation_rule: string | null;
  separate_written_consent_required: boolean;
  human_output_approval_required: boolean;
  attribution_required: boolean;
  model_retention_allowed: boolean;
  derived_model_allowed: boolean;
  term: string | null;
  territory: string | null;
  revocation_rule: string | null;
  license_contact: string | null;
  evidence_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const AI_CONSENT_COLS =
  "id,passport_key,asset_id,use_case,permission,compensation_rule,separate_written_consent_required,human_output_approval_required,attribution_required,model_retention_allowed,derived_model_allowed,term,territory,revocation_rule,license_contact,evidence_reference,notes,created_at,updated_at";

// ---- Licenses ----
export const licenseUpsertSchema = z.object({
  assetId: z.string().uuid(),
  licensee: z.string().trim().min(1).max(300),
  exactUse: optionalText(1000),
  permissionType: z.enum(LICENSE_PERMISSION_TYPES).optional(),
  startDate: z.string().trim().max(10).nullable().optional(),
  endDate: z.string().trim().max(10).nullable().optional(),
  territory: optionalText(120),
  isExclusive: z.boolean().optional(),
  aiSyntheticRightsIncluded: z.boolean().nullable().optional(),
  compensation: optionalText(500),
  controllingDocumentReference: optionalText(500),
  status: z.enum(LICENSE_STATUSES).optional(),
  notes: optionalText(2000),
});
export type LicenseUpsertInput = z.infer<typeof licenseUpsertSchema>;

export type LicenseRow = {
  id: string;
  passport_key: string;
  asset_id: string;
  licensee: string;
  exact_use: string | null;
  permission_type: LicensePermissionType;
  start_date: string | null;
  end_date: string | null;
  territory: string | null;
  is_exclusive: boolean;
  ai_synthetic_rights_included: boolean | null;
  compensation: string | null;
  controlling_document_reference: string | null;
  status: LicenseStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const LICENSE_COLS =
  "id,passport_key,asset_id,licensee,exact_use,permission_type,start_date,end_date,territory,is_exclusive,ai_synthetic_rights_included,compensation,controlling_document_reference,status,notes,created_at,updated_at";

// ---- Evidence ----
export const evidenceUpsertSchema = z.object({
  assetId: z.string().uuid(),
  evidenceType: z.enum(EVIDENCE_TYPES),
  sourceCreator: optionalText(300),
  issuedDate: z.string().trim().max(10).nullable().optional(),
  fileUrl: z.string().trim().url().max(1000).nullable().optional(),
  hashFingerprint: optionalText(200),
  hasContentCredential: z.boolean().optional(),
  credentialManifestReference: optionalText(500),
  copyrightTrademarkReference: optionalText(500),
  identityEvidenceReference: optionalText(500),
  verifiedBy: optionalText(200),
  verificationDate: z.string().trim().max(10).nullable().optional(),
  status: z.enum(EVIDENCE_STATUSES).optional(),
  notes: optionalText(2000),
});
export type EvidenceUpsertInput = z.infer<typeof evidenceUpsertSchema>;

export type EvidenceRow = {
  id: string;
  passport_key: string;
  asset_id: string;
  evidence_type: EvidenceType;
  source_creator: string | null;
  issued_date: string | null;
  file_url: string | null;
  hash_fingerprint: string | null;
  has_content_credential: boolean;
  credential_manifest_reference: string | null;
  copyright_trademark_reference: string | null;
  identity_evidence_reference: string | null;
  verified_by: string | null;
  verification_date: string | null;
  status: EvidenceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const EVIDENCE_COLS =
  "id,passport_key,asset_id,evidence_type,source_creator,issued_date,file_url,hash_fingerprint,has_content_credential,credential_manifest_reference,copyright_trademark_reference,identity_evidence_reference,verified_by,verification_date,status,notes,created_at,updated_at";

// ---- Review flags ----
export type ReviewFlagRow = {
  id: string;
  passport_key: string;
  rule_code: string;
  title: string;
  description: string;
  severity: FlagSeverity;
  affected_entity_type: FlagEntityType;
  affected_entity_id: string | null;
  evidence_context: string | null;
  recommended_action: string | null;
  status: FlagStatus;
  created_at: string;
  resolved_at: string | null;
  updated_at: string;
};

export const REVIEW_FLAG_COLS =
  "id,passport_key,rule_code,title,description,severity,affected_entity_type,affected_entity_id,evidence_context,recommended_action,status,created_at,resolved_at,updated_at";

export const EVIDENCE_DISCLAIMER =
  "Provenance evidence does not automatically establish legal ownership, government certification, trademark validity, or legal enforceability.";
