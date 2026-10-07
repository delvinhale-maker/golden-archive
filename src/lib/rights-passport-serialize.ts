/**
 * AurumVault Digital Rights Passport Generator — Round 4 public/private
 * serialization. THE single, centralized place public/private export
 * payloads are constructed (spec §N: "Build one centralized serializer for
 * PUBLIC payload. Do not construct public data ad hoc in multiple routes").
 *
 * Pure, dependency-free (no zod, no @supabase/supabase-js) — every field
 * copied into the output is named explicitly (allowlist, never a spread of
 * an input object), which is what makes it possible to guarantee a private
 * field can never leak through by accident: there is no code path by which
 * an unlisted input field reaches the output.
 *
 * DEVIATION FROM THE SPEC'S LITERAL WORKED JSON EXAMPLE (documented, not an
 * oversight): §H's example shows a top-level "passport_key" in the public
 * payload. §K explicitly forbids enumerating passport_key. Where these two
 * instructions conflict, §K's explicit security rule wins — the public
 * payload's "passport.passport_id" is the opaque public_id, and the real
 * internal passport_key never appears in either serializer's output.
 * Likewise, §H's `"licenses": []` becomes a non-confidential license_notice
 * string here rather than an array of real license records, honoring
 * §E/§G's "do NOT expose confidential license terms" instruction.
 *
 * SAFETY: never call these with raw DB rows and trust it to "just work" —
 * every field below was chosen deliberately. When adding a new workspace
 * field, decide explicitly whether it belongs in the public serializer,
 * the private one, neither, or both — never assume.
 */

export type PublicVerificationLevel =
  | "SELF_DECLARED"
  | "DOCUMENT_SUPPORTED"
  | "REPRESENTATIVE_VERIFIED"
  | "THIRD_PARTY_VERIFIED";

/** Public-facing verification labels — deliberately never "GOVERNMENT VERIFIED" / "LEGAL VERIFIED" / "OFFICIALLY CERTIFIED" (spec §H). */
export const PUBLIC_VERIFICATION_LABELS: Record<PublicVerificationLevel, string> = {
  SELF_DECLARED: "SELF-DECLARED",
  DOCUMENT_SUPPORTED: "DOCUMENT-SUPPORTED",
  REPRESENTATIVE_VERIFIED: "REPRESENTATIVE-VERIFIED",
  THIRD_PARTY_VERIFIED: "THIRD-PARTY-VERIFIED",
};

export type PublicAiPolicy =
  | "ALLOW"
  | "ALLOW_WITH_TERMS"
  | "PROHIBIT"
  | "CASE_BY_CASE"
  | "CONTACT_FOR_LICENSE"
  | "REVIEW_REQUIRED";

/** Public-facing AI permission labels (spec §E's exact wording) — never the raw enum string. */
export const PUBLIC_AI_PERMISSION_LABELS: Record<PublicAiPolicy, string> = {
  ALLOW: "ALLOWED",
  ALLOW_WITH_TERMS: "ALLOWED WITH TERMS",
  PROHIBIT: "PROHIBITED",
  CASE_BY_CASE: "CASE-BY-CASE",
  CONTACT_FOR_LICENSE: "CONTACT FOR LICENSE",
  REVIEW_REQUIRED: "REVIEW REQUIRED",
};

export const PUBLIC_RIGHTS_STATEMENT =
  "This Digital Rights Passport records the current published rights and AI-use declarations of the passport holder or authorized representative. It does not itself establish legal ownership, government registration, or legal enforceability.";

export const INTEROPERABILITY_NOTICE =
  "Field names in this export are informational and intended to be human- and machine-readable. This export does not claim conformance with C2PA, W3C, NIST, or any government standard unless explicitly stated and independently verified.";

// ---------------------------------------------------------------------------
// Input shapes — decoupled from any zod-defined DB row type on purpose.
// ---------------------------------------------------------------------------

export type SerializeAsset = {
  name: string;
  asset_type: string;
  territory: string | null;
  is_public: boolean;
  default_ai_policy: PublicAiPolicy;
  default_license_policy: string | null;
  claimed_owner_controller: string | null;
  control_basis: string;
  registration_identifier: string | null;
  evidence_location: string | null;
  representative: string | null;
  notes: string | null;
};

export type SerializeAiConsent = {
  asset_id: string | null;
  use_case: string;
  permission: PublicAiPolicy;
  compensation_rule: string | null;
  evidence_reference: string | null;
  license_contact: string | null;
  notes: string | null;
};

export type SerializeLicense = {
  status: string;
  is_exclusive: boolean;
  compensation: string | null;
  notes: string | null;
};

export type SerializeEvidence = {
  evidence_type: string;
  status: string;
  source_creator: string | null;
  file_url: string | null;
  hash_fingerprint: string | null;
  notes: string | null;
};

export type SerializePassport = {
  public_professional_name: string | null;
  legal_name: string | null;
  stage_brand_name: string | null;
  primary_role: string | null;
  jurisdiction: string | null;
  rights_contact_email: string | null;
  rights_entity: string | null;
  public_rights_url: string | null;
  verification_level: PublicVerificationLevel;
  representative_name: string | null;
  representative_contact: string | null;
  agent_manager_name: string | null;
  agent_manager_contact: string | null;
  successor_estate_contact: string | null;
  effective_date: string | null;
  review_frequency: string | null;
  public_notes: string | null;
  private_notes: string | null;
};

export type SerializeInput = {
  publicId: string;
  passportVersion: number;
  status: "ACTIVE" | "SUPERSEDED" | "REVOKED" | "ARCHIVED";
  publishedAt: string;
  effectiveAt: string | null;
  humanReadableUrl: string;
  passport: SerializePassport;
  assets: SerializeAsset[];
  aiConsents: SerializeAiConsent[];
  licenses: SerializeLicense[];
  evidence: SerializeEvidence[];
};

// ---------------------------------------------------------------------------
// PUBLIC serializer — the only source of truth for what a public payload contains
// ---------------------------------------------------------------------------

export type PublicPassportPayload = {
  passport: {
    schema_name: "AurumVault Digital Rights Passport";
    schema_version: "1.0";
    passport_id: string;
    passport_version: number;
    status: string;
    published_at: string;
    effective_at: string | null;
    human_readable_url: string;
  };
  subject: {
    public_name: string | null;
    professional_name: string | null;
    rights_entity: string | null;
    primary_role: string | null;
    jurisdiction: string | null;
    verification_level: string;
    rights_contact: { email: string | null; url: string | null };
  };
  assets: Array<{
    name: string;
    asset_type: string;
    territory: string | null;
    default_ai_policy: string;
    default_license_policy: string | null;
  }>;
  ai_permissions: Array<{ use_case: string; permission: string }>;
  license_notice: string | null;
  provenance: Array<{ evidence_type: string; status: string }>;
  legacy: {
    successor_planning_on_file: boolean;
    posthumous_ai_use: string;
  };
  notices: {
    legal_effect: string;
    standards: string;
  };
};

export function serializePublicPassport(input: SerializeInput): PublicPassportPayload {
  const passportWideConsents = input.aiConsents.filter((c) => c.asset_id === null);
  const posthumous = passportWideConsents.find((c) => c.use_case === "POSTHUMOUS_ESTATE_USE");

  return {
    passport: {
      schema_name: "AurumVault Digital Rights Passport",
      schema_version: "1.0",
      passport_id: input.publicId,
      passport_version: input.passportVersion,
      status: input.status,
      published_at: input.publishedAt,
      effective_at: input.effectiveAt,
      human_readable_url: input.humanReadableUrl,
    },
    subject: {
      public_name: input.passport.public_professional_name,
      professional_name: input.passport.stage_brand_name,
      rights_entity: input.passport.rights_entity,
      primary_role: input.passport.primary_role,
      jurisdiction: input.passport.jurisdiction,
      verification_level: PUBLIC_VERIFICATION_LABELS[input.passport.verification_level],
      rights_contact: {
        email: input.passport.rights_contact_email,
        url: input.passport.public_rights_url,
      },
    },
    assets: input.assets
      .filter((a) => a.is_public)
      .map((a) => ({
        name: a.name,
        asset_type: a.asset_type,
        territory: a.territory,
        default_ai_policy: PUBLIC_AI_PERMISSION_LABELS[a.default_ai_policy],
        default_license_policy: a.default_license_policy,
      })),
    ai_permissions: passportWideConsents.map((c) => ({
      use_case: c.use_case,
      permission: PUBLIC_AI_PERMISSION_LABELS[c.permission],
    })),
    license_notice:
      input.licenses.length > 0
        ? "One or more existing licensing agreements may affect these declared defaults."
        : null,
    provenance: input.evidence
      .filter((e) => e.evidence_type !== "IDENTITY_DOCUMENT")
      .map((e) => ({ evidence_type: e.evidence_type, status: e.status })),
    legacy: {
      successor_planning_on_file: !!input.passport.successor_estate_contact?.trim(),
      posthumous_ai_use: posthumous
        ? PUBLIC_AI_PERMISSION_LABELS[posthumous.permission]
        : "NOT DECLARED",
    },
    notices: {
      legal_effect: PUBLIC_RIGHTS_STATEMENT,
      standards: INTEROPERABILITY_NOTICE,
    },
  };
}

// ---------------------------------------------------------------------------
// PRIVATE serializer — the owner's own detailed copy. Still never includes
// raw contract text, storage paths, signed URLs, or model/analysis
// metadata — those are not "passport data," they're internal system
// artifacts the owner already has direct access to via Upload & Analyze.
// ---------------------------------------------------------------------------

export type PrivatePassportPayload = PublicPassportPayload & {
  private: {
    legal_name: string | null;
    representative: { name: string | null; contact: string | null };
    agent_manager: { name: string | null; contact: string | null };
    successor_estate_contact: string | null;
    private_notes: string | null;
    review_frequency: string | null;
    assets: Array<{
      name: string;
      asset_type: string;
      is_public: boolean;
      claimed_owner_controller: string | null;
      control_basis: string;
      registration_identifier: string | null;
      evidence_location: string | null;
      representative: string | null;
      notes: string | null;
    }>;
    ai_permissions_full: Array<{
      asset_id: string | null;
      use_case: string;
      permission: string;
      compensation_rule: string | null;
      license_contact: string | null;
      notes: string | null;
    }>;
    licenses: Array<{
      status: string;
      is_exclusive: boolean;
      compensation: string | null;
      notes: string | null;
    }>;
    evidence: Array<{
      evidence_type: string;
      status: string;
      source_creator: string | null;
      notes: string | null;
    }>;
  };
};

export function serializePrivatePassport(input: SerializeInput): PrivatePassportPayload {
  const publicPayload = serializePublicPassport(input);
  return {
    ...publicPayload,
    private: {
      legal_name: input.passport.legal_name,
      representative: {
        name: input.passport.representative_name,
        contact: input.passport.representative_contact,
      },
      agent_manager: {
        name: input.passport.agent_manager_name,
        contact: input.passport.agent_manager_contact,
      },
      successor_estate_contact: input.passport.successor_estate_contact,
      private_notes: input.passport.private_notes,
      review_frequency: input.passport.review_frequency,
      assets: input.assets.map((a) => ({
        name: a.name,
        asset_type: a.asset_type,
        is_public: a.is_public,
        claimed_owner_controller: a.claimed_owner_controller,
        control_basis: a.control_basis,
        registration_identifier: a.registration_identifier,
        evidence_location: a.evidence_location,
        representative: a.representative,
        notes: a.notes,
      })),
      ai_permissions_full: input.aiConsents.map((c) => ({
        asset_id: c.asset_id,
        use_case: c.use_case,
        permission: PUBLIC_AI_PERMISSION_LABELS[c.permission],
        compensation_rule: c.compensation_rule,
        license_contact: c.license_contact,
        notes: c.notes,
      })),
      licenses: input.licenses.map((l) => ({
        status: l.status,
        is_exclusive: l.is_exclusive,
        compensation: l.compensation,
        notes: l.notes,
      })),
      evidence: input.evidence.map((e) => ({
        evidence_type: e.evidence_type,
        status: e.status,
        source_creator: e.source_creator,
        notes: e.notes,
      })),
    },
  };
}
