/**
 * AurumVault Digital Rights Passport Generator — shared enums, types, and
 * Zod validators.
 *
 * Kept as its own module (unlike this codebase's usual convention of
 * inlining a schema next to its one server function) because it's reused
 * across passports.functions.ts, assets.functions.ts, the readiness score,
 * and every screen — this schema is genuinely larger and more widely shared
 * than anything else in the app so far.
 *
 * SAFETY: this tool is educational and organizational. Nothing here
 * computes, infers, or asserts legal ownership — REVIEW_REQUIRED is a first-
 * class value throughout precisely so uncertain claims have somewhere
 * honest to live instead of being forced into a false-confidence bucket.
 */
import { z } from "zod";

export const RIGHTS_PASSPORT_DISCLAIMER =
  "This tool is educational and organizational. It does not create a government registration, establish legal ownership, or replace legal advice.";

export const PASSPORT_STATUSES = ["DRAFT", "ACTIVE", "SUPERSEDED", "REVOKED", "ARCHIVED"] as const;
export type PassportStatus = (typeof PASSPORT_STATUSES)[number];

export const VERIFICATION_LEVELS = [
  "SELF_DECLARED",
  "DOCUMENT_SUPPORTED",
  "REPRESENTATIVE_VERIFIED",
  "THIRD_PARTY_VERIFIED",
] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export const VERIFICATION_LEVEL_LABELS: Record<VerificationLevel, string> = {
  SELF_DECLARED: "Self-declared",
  DOCUMENT_SUPPORTED: "Document-supported",
  REPRESENTATIVE_VERIFIED: "Representative-verified",
  THIRD_PARTY_VERIFIED: "Third-party-verified",
};

export const ASSET_TYPES = [
  "NAME",
  "STAGE_NAME",
  "LIKENESS_IMAGE",
  "VOICE",
  "SIGNATURE",
  "MOVEMENT_MANNERISM",
  "BIOGRAPHY",
  "SOCIAL_HANDLE",
  "CREATIVE_WORK",
  "MUSIC",
  "BOOK_WRITING",
  "VIDEO_FILM",
  "PHOTOGRAPH",
  "ARTWORK_DESIGN",
  "CHARACTER",
  "TRADEMARK_MARK",
  "LOGO",
  "COURSE_TRAINING",
  "PODCAST_MEDIA",
  "DIGITAL_PRODUCT",
  "DATASET_ARCHIVE",
  "OTHER",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const CONTROL_BASES = [
  "CREATORSHIP",
  "CONTRACT",
  "ASSIGNMENT",
  "LICENSE",
  "TRADEMARK",
  "PUBLICITY_PERSONALITY_RIGHT",
  "ENTITY_OWNERSHIP",
  "REPRESENTATIVE_AUTHORITY",
  "OTHER",
  "REVIEW_REQUIRED",
] as const;
export type ControlBasis = (typeof CONTROL_BASES)[number];

export const ASSET_STATUSES = ["ACTIVE", "DISPUTED", "REVIEW_REQUIRED", "ARCHIVED"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const AI_POLICIES = [
  "ALLOW",
  "ALLOW_WITH_TERMS",
  "PROHIBIT",
  "CASE_BY_CASE",
  "CONTACT_FOR_LICENSE",
  "REVIEW_REQUIRED",
] as const;
export type AiPolicy = (typeof AI_POLICIES)[number];

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const passportUpsertSchema = z.object({
  publicProfessionalName: optionalText(200),
  legalName: optionalText(200),
  stageBrandName: optionalText(200),
  primaryRole: optionalText(120),
  jurisdiction: optionalText(120),
  rightsContactEmail: z.string().trim().email().max(200).nullable().optional(),
  rightsEntity: optionalText(200),
  publicRightsUrl: z.string().trim().url().max(500).nullable().optional(),
  verificationLevel: z.enum(VERIFICATION_LEVELS).optional(),
  representativeName: optionalText(200),
  representativeContact: optionalText(200),
  agentManagerName: optionalText(200),
  agentManagerContact: optionalText(200),
  successorEstateContact: optionalText(200),
  effectiveDate: z.string().trim().max(10).nullable().optional(), // YYYY-MM-DD
  reviewFrequency: optionalText(60),
  publicNotes: optionalText(2000),
  privateNotes: optionalText(4000),
});
export type PassportUpsertInput = z.infer<typeof passportUpsertSchema>;

export const assetUpsertSchema = z.object({
  assetType: z.enum(ASSET_TYPES),
  name: z.string().trim().min(1).max(200),
  description: optionalText(2000),
  claimedOwnerController: optionalText(200),
  controlBasis: z.enum(CONTROL_BASES).optional(),
  registrationIdentifier: optionalText(200),
  evidenceLocation: optionalText(500),
  isPublic: z.boolean().optional(),
  defaultAiPolicy: z.enum(AI_POLICIES).optional(),
  defaultLicensePolicy: optionalText(500),
  territory: optionalText(120),
  expiryDate: z.string().trim().max(10).nullable().optional(),
  representative: optionalText(200),
  status: z.enum(ASSET_STATUSES).optional(),
  notes: optionalText(2000),
});
export type AssetUpsertInput = z.infer<typeof assetUpsertSchema>;

export type PassportRow = {
  id: string;
  passport_key: string;
  version: number;
  previous_version_id: string | null;
  status: PassportStatus;
  public_professional_name: string | null;
  legal_name: string | null;
  stage_brand_name: string | null;
  primary_role: string | null;
  jurisdiction: string | null;
  rights_contact_email: string | null;
  rights_entity: string | null;
  public_rights_url: string | null;
  verification_level: VerificationLevel;
  representative_name: string | null;
  representative_contact: string | null;
  agent_manager_name: string | null;
  agent_manager_contact: string | null;
  successor_estate_contact: string | null;
  effective_date: string | null;
  review_frequency: string | null;
  public_notes: string | null;
  private_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetRow = {
  id: string;
  passport_key: string;
  asset_type: AssetType;
  name: string;
  description: string | null;
  claimed_owner_controller: string | null;
  control_basis: ControlBasis;
  registration_identifier: string | null;
  evidence_location: string | null;
  is_public: boolean;
  default_ai_policy: AiPolicy;
  default_license_policy: string | null;
  territory: string | null;
  expiry_date: string | null;
  representative: string | null;
  status: AssetStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const PASSPORT_COLS =
  "id,passport_key,version,previous_version_id,status,public_professional_name,legal_name,stage_brand_name,primary_role,jurisdiction,rights_contact_email,rights_entity,public_rights_url,verification_level,representative_name,representative_contact,agent_manager_name,agent_manager_contact,successor_estate_contact,effective_date,review_frequency,public_notes,private_notes,created_at,updated_at";

export const ASSET_COLS =
  "id,passport_key,asset_type,name,description,claimed_owner_controller,control_basis,registration_identifier,evidence_location,is_public,default_ai_policy,default_license_policy,territory,expiry_date,representative,status,notes,created_at,updated_at";
