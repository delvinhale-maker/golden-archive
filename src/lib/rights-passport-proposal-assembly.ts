/**
 * AurumVault Digital Rights Passport Generator — Round 3.5 structured
 * proposal assembly.
 *
 * Pure, dependency-free (no zod, no @supabase/supabase-js), matching the
 * established pattern in rights-passport-risk-rules.ts and
 * rights-passport-analysis-confidence.ts — this module is safely importable
 * from that confidence module too (also pure), so isHighImpactField is
 * reused directly rather than duplicated again.
 *
 * SEARCH FIRST (Round 3.5 spec §C/§L): no new table backs a "proposal" —
 * a StructuredProposal is deterministically DERIVED from the PENDING
 * findings already sitting in rights_analysis_findings (Round 3's table).
 * Applying a proposal is really "decide ACCEPT/EDIT/REJECT/DEFER on all its
 * constituent findings at once, then write one aggregated record" — the
 * actual mutation and idempotency logic lives in
 * rights-passport-proposals.functions.ts; this module only groups,
 * evaluates missing fields, and flags where extra confirmation is required.
 *
 * SAFETY: assembleProposals only ever GROUPS AND SHAPES DATA. It writes
 * nothing and asserts nothing as verified fact — e.g. an ASSET proposal's
 * control_basis is always "REVIEW_REQUIRED" here, never inferred from
 * ownership/assignment language as a confirmed basis (Round 3.5 spec §1).
 */
import { isHighImpactField } from "@/lib/rights-passport-analysis-confidence";
import type { JsonValue } from "@/lib/rights-passport-json";

export const PROPOSAL_TYPES = [
  "ASSET",
  "LICENSE",
  "EVIDENCE",
  "PROFILE_UPDATE",
  "AI_CONSENT",
] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

export const PROPOSAL_STATUSES = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "ACCEPTED",
  "EDITED",
  "REJECTED",
  "APPLIED",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type AssemblyFindingSource = {
  document_id: string;
  page: number | null;
  section: string | null;
  quote: string;
} | null;

/** Minimal finding shape this module needs — decoupled from the DB row/Zod type. */
export type AssemblyFinding = {
  id: string;
  passType: string;
  field: string;
  normalizedValue: unknown;
  rawValue: string | null;
  source: AssemblyFindingSource;
  reviewStatus: "PENDING" | "ACCEPTED" | "EDITED" | "REJECTED" | "DEFERRED";
};

export type StructuredProposal = {
  proposalKey: string;
  proposalType: ProposalType;
  documentId: string;
  sourceFindingIds: string[];
  proposedRecord: Record<string, JsonValue>;
  missingFields: string[];
  requiresHighImpactConfirmation: boolean;
  status: ProposalStatus;
};

/** AI_FIELD_TO_USE_CASE duplicated here in literal form for the same
 * dependency-free reason documented in rights-passport-analysis-confidence
 * .ts — this must stay in sync with rights-passport-analysis-schema.ts's
 * copy; a source-level test in tests/integration verifies that. */
const AI_FIELD_TO_USE_CASE: Record<string, string> = {
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
};

function byField(
  findings: AssemblyFinding[],
  passType: string,
  field: string,
): AssemblyFinding | null {
  return (
    findings.find(
      (f) => f.passType === passType && f.field === field && f.reviewStatus === "PENDING",
    ) ?? null
  );
}

function effectiveText(f: AssemblyFinding | null): string | null {
  if (!f) return null;
  if (typeof f.normalizedValue === "string" && f.normalizedValue.trim()) return f.normalizedValue;
  return f.rawValue;
}

function proposalKey(type: ProposalType, documentId: string, findingIds: string[]): string {
  return `${type}::${documentId}::${[...findingIds].sort().join(",")}`;
}

function anyHighImpact(contributors: AssemblyFinding[]): boolean {
  return contributors.some((f) => isHighImpactField(f.passType, f.field));
}

/**
 * A proposal's status reflects its constituent findings' review_status —
 * READY_FOR_REVIEW while any are PENDING (with missing required fields
 * downgrading it to DRAFT), ACCEPTED/EDITED once decided, REJECTED if the
 * user rejected it (no partial states — Round 3.5's UX is one decision per
 * proposal, cascaded to every finding that composed it).
 */
function deriveStatus(contributors: AssemblyFinding[], missingFields: string[]): ProposalStatus {
  const statuses = new Set(contributors.map((f) => f.reviewStatus));
  if (statuses.has("REJECTED") && statuses.size === 1) return "REJECTED";
  if (statuses.has("ACCEPTED") || statuses.has("EDITED")) {
    return statuses.has("EDITED") ? "EDITED" : "ACCEPTED";
  }
  if (missingFields.length > 0) return "DRAFT";
  return "READY_FOR_REVIEW";
}

// ---------------------------------------------------------------------------
// AI_CONSENT — unchanged 1:1 mapping, wrapped as a proposal for UI consistency
// ---------------------------------------------------------------------------

function assembleAiConsentProposals(
  documentId: string,
  findings: AssemblyFinding[],
): StructuredProposal[] {
  return findings
    .filter(
      (f) =>
        f.passType === "AI_SYNTHETIC_RIGHTS" &&
        f.reviewStatus === "PENDING" &&
        AI_FIELD_TO_USE_CASE[f.field],
    )
    .map((f) => {
      const useCase = AI_FIELD_TO_USE_CASE[f.field];
      const permission = typeof f.normalizedValue === "string" ? f.normalizedValue : null;
      const missingFields = permission ? [] : ["permission"];
      return {
        proposalKey: proposalKey("AI_CONSENT", documentId, [f.id]),
        proposalType: "AI_CONSENT" as const,
        documentId,
        sourceFindingIds: [f.id],
        proposedRecord: { useCase, permission },
        missingFields,
        requiresHighImpactConfirmation: anyHighImpact([f]),
        status: deriveStatus([f], missingFields),
      };
    });
}

// ---------------------------------------------------------------------------
// PROFILE_UPDATE — 1:1, one proposal per identity field with a real mapping
// ---------------------------------------------------------------------------

const PROFILE_FIELD_MAP: Record<string, string> = {
  governing_law: "jurisdiction",
  effective_date: "effectiveDate",
};

function assembleProfileProposals(
  documentId: string,
  findings: AssemblyFinding[],
): StructuredProposal[] {
  return findings
    .filter(
      (f) =>
        f.passType === "DOCUMENT_STRUCTURE" &&
        f.reviewStatus === "PENDING" &&
        PROFILE_FIELD_MAP[f.field],
    )
    .map((f) => {
      const passportField = PROFILE_FIELD_MAP[f.field];
      const suggestedValue = effectiveText(f);
      const missingFields = suggestedValue ? [] : [passportField];
      return {
        proposalKey: proposalKey("PROFILE_UPDATE", documentId, [f.id]),
        proposalType: "PROFILE_UPDATE" as const,
        documentId,
        sourceFindingIds: [f.id],
        proposedRecord: { field: passportField, suggestedValue },
        missingFields,
        requiresHighImpactConfirmation: anyHighImpact([f]),
        status: deriveStatus([f], missingFields),
      };
    });
}

// ---------------------------------------------------------------------------
// ASSET — grouped by document, seeded by ownership/assignment language
// ---------------------------------------------------------------------------

const ASSET_SEED_FIELDS = ["ownership_language", "assignment"];

function assembleAssetProposal(
  documentId: string,
  findings: AssemblyFinding[],
): StructuredProposal | null {
  const seeds = findings.filter(
    (f) =>
      f.passType === "RIGHTS_GRANT" &&
      ASSET_SEED_FIELDS.includes(f.field) &&
      f.reviewStatus === "PENDING",
  );
  if (seeds.length === 0) return null;

  const parties = byField(findings, "DOCUMENT_STRUCTURE", "parties");
  const territory =
    byField(findings, "RIGHTS_GRANT", "territory") ??
    byField(findings, "DOCUMENT_STRUCTURE", "territory");
  const ownership = byField(findings, "RIGHTS_GRANT", "ownership_language");
  const assignment = byField(findings, "RIGHTS_GRANT", "assignment");

  const contributors = [ownership, assignment, parties, territory].filter(
    (f): f is AssemblyFinding => f !== null,
  );
  const descriptionParts: string[] = [];
  if (ownership)
    descriptionParts.push(
      `The document appears to state (ownership): "${effectiveText(ownership)}"`,
    );
  if (assignment)
    descriptionParts.push(
      `The document appears to state (assignment): "${effectiveText(assignment)}"`,
    );

  const proposedRecord: Record<string, JsonValue> = {
    name: null, // never guessed — the user must supply/confirm this
    assetType: "OTHER",
    claimedOwnerController: effectiveText(parties),
    controlBasis: "REVIEW_REQUIRED", // always — never inferred as CREATORSHIP/etc. from document language
    territory: effectiveText(territory),
    description: descriptionParts.join(" ") || null,
  };

  const missingFields = ["name"]; // always requires explicit user input — no source field is safe to guess from

  return {
    proposalKey: proposalKey(
      "ASSET",
      documentId,
      contributors.map((f) => f.id),
    ),
    proposalType: "ASSET",
    documentId,
    sourceFindingIds: contributors.map((f) => f.id),
    proposedRecord,
    missingFields,
    requiresHighImpactConfirmation: anyHighImpact(contributors),
    status: deriveStatus(contributors, missingFields),
  };
}

// ---------------------------------------------------------------------------
// LICENSE — grouped by document; requires a target asset chosen at apply time
// ---------------------------------------------------------------------------

const LICENSE_SEED_FIELDS: Array<{ passType: string; field: string }> = [
  { passType: "RIGHTS_GRANT", field: "licenses_granted" },
  { passType: "RIGHTS_GRANT", field: "exclusivity" },
  { passType: "COMMERCIAL_TERMS", field: "compensation" },
  { passType: "COMMERCIAL_TERMS", field: "fee" },
  { passType: "COMMERCIAL_TERMS", field: "royalty" },
];

function inferExclusivity(text: string | null): boolean | null {
  if (!text) return null;
  if (/non-?exclusive/i.test(text)) return false;
  if (/exclusive/i.test(text)) return true;
  return null;
}

function assembleLicenseProposal(
  documentId: string,
  findings: AssemblyFinding[],
  originalFileName: string,
): StructuredProposal | null {
  const hasSeed = LICENSE_SEED_FIELDS.some((s) =>
    findings.some(
      (f) => f.passType === s.passType && f.field === s.field && f.reviewStatus === "PENDING",
    ),
  );
  if (!hasSeed) return null;

  const parties = byField(findings, "DOCUMENT_STRUCTURE", "parties");
  const effectiveDate = byField(findings, "DOCUMENT_STRUCTURE", "effective_date");
  const territory =
    byField(findings, "RIGHTS_GRANT", "territory") ??
    byField(findings, "DOCUMENT_STRUCTURE", "territory");
  const licensesGranted = byField(findings, "RIGHTS_GRANT", "licenses_granted");
  const exclusivity = byField(findings, "RIGHTS_GRANT", "exclusivity");
  const compensation =
    byField(findings, "COMMERCIAL_TERMS", "compensation") ??
    byField(findings, "COMMERCIAL_TERMS", "fee") ??
    byField(findings, "COMMERCIAL_TERMS", "royalty");

  const contributors = [
    parties,
    effectiveDate,
    territory,
    licensesGranted,
    exclusivity,
    compensation,
  ].filter((f): f is AssemblyFinding => f !== null);

  const proposedRecord: Record<string, JsonValue> = {
    licensee: effectiveText(parties),
    exactUse: effectiveText(licensesGranted),
    permissionType: "LICENSE",
    startDate: null, // dates in extracted text aren't reliably ISO-parseable — left for user entry
    endDate: null,
    territory: effectiveText(territory),
    isExclusive: inferExclusivity(effectiveText(exclusivity)),
    aiSyntheticRightsIncluded: null, // "Not found" — never cross-inferred from the AI_SYNTHETIC_RIGHTS pass
    compensation: effectiveText(compensation),
    controllingDocumentReference: `${originalFileName} (uploaded document)`,
    status: "REVIEW_REQUIRED", // never ACTIVE at assembly/apply time — user must explicitly activate later
  };

  const missingFields: string[] = [];
  if (!proposedRecord.licensee) missingFields.push("licensee");
  if (!proposedRecord.exactUse) missingFields.push("exactUse");
  if (proposedRecord.aiSyntheticRightsIncluded === null)
    missingFields.push("aiSyntheticRightsIncluded");

  return {
    proposalKey: proposalKey(
      "LICENSE",
      documentId,
      contributors.map((f) => f.id),
    ),
    proposalType: "LICENSE",
    documentId,
    sourceFindingIds: contributors.map((f) => f.id),
    proposedRecord,
    missingFields,
    requiresHighImpactConfirmation: anyHighImpact(contributors),
    status: deriveStatus(contributors, missingFields),
  };
}

// ---------------------------------------------------------------------------
// EVIDENCE — "this document itself is evidence" proposal
// ---------------------------------------------------------------------------

function assembleEvidenceProposal(
  documentId: string,
  findings: AssemblyFinding[],
  originalFileName: string,
): StructuredProposal | null {
  const agreementType = byField(findings, "DOCUMENT_STRUCTURE", "agreement_type");
  if (!agreementType) return null;

  const parties = byField(findings, "DOCUMENT_STRUCTURE", "parties");
  const executionDate =
    byField(findings, "DOCUMENT_STRUCTURE", "execution_date") ??
    byField(findings, "DOCUMENT_STRUCTURE", "effective_date");
  const contributors = [agreementType, parties, executionDate].filter(
    (f): f is AssemblyFinding => f !== null,
  );

  const proposedRecord: Record<string, JsonValue> = {
    evidenceType: "CONTRACT",
    sourceCreator: effectiveText(parties),
    issuedDate: effectiveText(executionDate),
    hasContentCredential: false,
    status: "SELF_DECLARED", // never VERIFIED from AI analysis alone
    notes: `Source document: ${originalFileName}`,
  };

  return {
    proposalKey: proposalKey(
      "EVIDENCE",
      documentId,
      contributors.map((f) => f.id),
    ),
    proposalType: "EVIDENCE",
    documentId,
    sourceFindingIds: contributors.map((f) => f.id),
    proposedRecord,
    missingFields: [],
    requiresHighImpactConfirmation: anyHighImpact(contributors),
    status: deriveStatus(contributors, []),
  };
}

export function assembleProposals(
  documentId: string,
  originalFileName: string,
  findings: AssemblyFinding[],
): StructuredProposal[] {
  const proposals: StructuredProposal[] = [];
  proposals.push(...assembleAiConsentProposals(documentId, findings));
  proposals.push(...assembleProfileProposals(documentId, findings));
  const asset = assembleAssetProposal(documentId, findings);
  if (asset) proposals.push(asset);
  const license = assembleLicenseProposal(documentId, findings, originalFileName);
  if (license) proposals.push(license);
  const evidence = assembleEvidenceProposal(documentId, findings, originalFileName);
  if (evidence) proposals.push(evidence);
  return proposals;
}

/** True when `existing` is a real, non-null value that differs from `incoming` — the generic "don't silently overwrite" check reused for AI Consent and Profile fields (Round 3.5 spec §D). */
export function hasConflictingExistingValue(existing: unknown, incoming: unknown): boolean {
  if (existing === null || existing === undefined || existing === "") return false;
  return existing !== incoming;
}
