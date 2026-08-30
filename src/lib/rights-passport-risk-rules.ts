/**
 * AurumVault Risk & Conflict Review™ — deterministic rule engine.
 *
 * Pure, dependency-free, and intentionally NOT AI. Every rule here is a
 * plain conditional over already-declared data. The engine never infers
 * legal validity — it flags for human review, using REVIEW_REQUIRED-style
 * language throughout. Rule codes are stable strings, never renumbered,
 * because the sync layer (rights-passport-review.functions.ts) uses
 * (rule_code, entityType, entityId) as an idempotency key.
 */
import type { PassportRow, AssetRow, VerificationLevel } from "@/lib/rights-passport.schema";
import type {
  AiConsentRow,
  LicenseRow,
  EvidenceRow,
  AiUseCase,
} from "@/lib/rights-passport-workspace.schema";

// Duplicated (not imported) from rights-passport-workspace.schema.ts on
// purpose — that module has a top-level `import { z } from "zod"`, which
// would make this file (deliberately pure/dependency-free, like
// rights-passport-readiness.ts) unable to load in this sandbox's test
// runner. A type-only import is erased at compile time and safe; a value
// import is not. Keep this list in sync with HIGH_RISK_AI_USE_CASES there —
// the risk-rules.test.ts "5 high-risk use cases" assertion will catch drift.
const HIGH_RISK_AI_USE_CASES: AiUseCase[] = [
  "VOICE_CLONE",
  "DIGITAL_REPLICA",
  "GENERATED_ADVERTISEMENT",
  "COMMERCIAL_MODEL_OUTPUT",
  "POSTHUMOUS_ESTATE_USE",
];

export type RiskSeverity = "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
export type RiskEntityType = "passport" | "asset" | "ai_consent" | "license" | "evidence";

export type RiskFlag = {
  ruleCode: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  entityType: RiskEntityType;
  entityId: string | null;
  evidenceContext: string | null;
  recommendedAction: string;
};

export type RiskRuleInput = {
  passport: Pick<
    PassportRow,
    | "status"
    | "public_professional_name"
    | "rights_contact_email"
    | "verification_level"
    | "effective_date"
    | "successor_estate_contact"
    | "review_frequency"
  >;
  assets: Pick<
    AssetRow,
    | "id"
    | "name"
    | "status"
    | "control_basis"
    | "default_ai_policy"
    | "default_license_policy"
    | "is_public"
  >[];
  aiConsents: Pick<
    AiConsentRow,
    "id" | "asset_id" | "use_case" | "permission" | "term" | "revocation_rule"
  >[];
  licenses: Pick<
    LicenseRow,
    | "id"
    | "asset_id"
    | "status"
    | "end_date"
    | "is_exclusive"
    | "ai_synthetic_rights_included"
    | "controlling_document_reference"
  >[];
  evidence: Pick<EvidenceRow, "id" | "asset_id" | "evidence_type" | "status">[];
};

function isPastDate(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export function evaluateRiskRules(input: RiskRuleInput): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const { passport, assets, aiConsents, licenses, evidence } = input;

  // ---- IDENTITY ----
  if (!passport.public_professional_name?.trim()) {
    flags.push({
      ruleCode: "IDENTITY_MISSING_NAME",
      title: "Missing public/professional name",
      description: "This passport has no public or professional name on record.",
      severity: "HIGH",
      entityType: "passport",
      entityId: null,
      evidenceContext: null,
      recommendedAction: "Add a public/professional name in Passport Details.",
    });
  }
  if (!passport.rights_contact_email?.trim()) {
    flags.push({
      ruleCode: "IDENTITY_MISSING_RIGHTS_CONTACT",
      title: "Missing rights contact",
      description:
        "This passport has no rights contact email — no one can be reached about licensing.",
      severity: "HIGH",
      entityType: "passport",
      entityId: null,
      evidenceContext: null,
      recommendedAction: "Add a rights contact email in Passport Details.",
    });
  }
  if ((passport.verification_level as VerificationLevel) === "SELF_DECLARED") {
    flags.push({
      ruleCode: "IDENTITY_SELF_DECLARED_ONLY",
      title: "Verification level is still self-declared",
      description: "This passport's identity has not been document- or representative-verified.",
      severity: "MODERATE",
      entityType: "passport",
      entityId: null,
      evidenceContext: null,
      recommendedAction: "Consider raising the verification level once supporting documents exist.",
    });
  }

  // ---- ASSETS ----
  const activeAssets = assets.filter((a) => a.status !== "ARCHIVED");
  if (activeAssets.length === 0) {
    flags.push({
      ruleCode: "ASSETS_ZERO_REGISTERED",
      title: "No assets registered",
      description: "This passport has no assets in the Rights Asset Registry.",
      severity: "HIGH",
      entityType: "passport",
      entityId: null,
      evidenceContext: null,
      recommendedAction: "Register at least one asset.",
    });
  }
  for (const asset of activeAssets) {
    if (asset.status === "DISPUTED") {
      flags.push({
        ruleCode: "ASSET_DISPUTED",
        title: `"${asset.name}" is marked disputed`,
        description: "This asset's status is DISPUTED and needs resolution.",
        severity: "HIGH",
        entityType: "asset",
        entityId: asset.id,
        evidenceContext: null,
        recommendedAction: "Review and resolve the dispute, or document the basis for the claim.",
      });
    }
    if (asset.control_basis === "REVIEW_REQUIRED") {
      flags.push({
        ruleCode: "ASSET_CONTROL_BASIS_REVIEW_REQUIRED",
        title: `"${asset.name}" has an unresolved control basis`,
        description: "This asset's control basis (how you control/own it) has not been determined.",
        severity: "CRITICAL",
        entityType: "asset",
        entityId: asset.id,
        evidenceContext: null,
        recommendedAction: "Determine and record how you control or own this asset.",
      });
    }
    const hasEvidence = evidence.some((e) => e.asset_id === asset.id);
    if (!hasEvidence) {
      flags.push({
        ruleCode: "ASSET_MISSING_EVIDENCE",
        title: `"${asset.name}" has no supporting evidence`,
        description: "This asset has no records in the Provenance & Evidence Register.",
        severity: "MODERATE",
        entityType: "asset",
        entityId: asset.id,
        evidenceContext: null,
        recommendedAction: "Attach supporting documents or references for this asset.",
      });
    }
  }

  // ---- AI CONSENT ----
  const consentByUseCase = new Map(
    aiConsents.filter((c) => !c.asset_id).map((c) => [c.use_case, c]),
  );
  for (const useCase of HIGH_RISK_AI_USE_CASES) {
    if (!consentByUseCase.has(useCase)) {
      flags.push({
        ruleCode: "AI_HIGH_RISK_USE_NOT_DECLARED",
        title: `High-risk AI use not declared: ${useCase.replace(/_/g, " ")}`,
        description: "This is a high-risk AI use case with no declared permission (NOT DECLARED).",
        severity: "HIGH",
        entityType: "passport",
        entityId: null,
        evidenceContext: useCase,
        recommendedAction: "Declare a permission for this use case in the AI Consent Builder.",
      });
    }
  }
  for (const consent of aiConsents) {
    if (consent.permission === "REVIEW_REQUIRED") {
      flags.push({
        ruleCode: "AI_PERMISSION_REVIEW_REQUIRED",
        title: `AI permission needs review: ${consent.use_case.replace(/_/g, " ")}`,
        description: "This AI use case is marked REVIEW REQUIRED.",
        severity: "MODERATE",
        entityType: "ai_consent",
        entityId: consent.id,
        evidenceContext: null,
        recommendedAction: "Decide on a permission for this use case.",
      });
    }
    const isUnguardedHighRiskAllow =
      consent.permission === "ALLOW" &&
      (consent.use_case === "DIGITAL_REPLICA" || consent.use_case === "VOICE_CLONE") &&
      !consent.term?.trim() &&
      !consent.revocation_rule?.trim();
    if (isUnguardedHighRiskAllow) {
      flags.push({
        ruleCode: "AI_HIGH_RISK_ALLOWED_WITHOUT_TERMS",
        title: `${consent.use_case.replace(/_/g, " ")} is allowed without documented terms`,
        description:
          "This high-risk use is set to Allow with no term or revocation rule documented.",
        severity: "HIGH",
        entityType: "ai_consent",
        entityId: consent.id,
        evidenceContext: null,
        recommendedAction:
          "Document a term and revocation rule, or change this to Allow with Terms.",
      });
    }
  }

  // ---- LICENSES ----
  const assetById = new Map(assets.map((a) => [a.id, a]));
  for (const license of licenses) {
    if (license.status === "ACTIVE" && license.is_exclusive) {
      flags.push({
        ruleCode: "LICENSE_ACTIVE_EXCLUSIVE",
        title: "Active exclusive license on record",
        description:
          "An active, exclusive license exists — confirm this doesn't conflict with other plans for this asset.",
        severity: "MODERATE",
        entityType: "license",
        entityId: license.id,
        evidenceContext: null,
        recommendedAction: "Confirm no other exclusive arrangements exist for this asset.",
      });
    }
    if (license.status === "ACTIVE" && isPastDate(license.end_date)) {
      flags.push({
        ruleCode: "LICENSE_EXPIRED_STILL_ACTIVE",
        title: "License end date has passed but status is still Active",
        description: "This license's end date is in the past but its status has not been updated.",
        severity: "HIGH",
        entityType: "license",
        entityId: license.id,
        evidenceContext: license.end_date,
        recommendedAction: "Update the license status, or confirm it renews automatically.",
      });
    }
    if (license.ai_synthetic_rights_included == null) {
      flags.push({
        ruleCode: "LICENSE_AI_RIGHTS_UNKNOWN",
        title: "AI/synthetic rights not specified",
        description: "Whether this license includes AI/synthetic rights has not been recorded.",
        severity: "MODERATE",
        entityType: "license",
        entityId: license.id,
        evidenceContext: null,
        recommendedAction: "Determine and record whether AI/synthetic rights are included.",
      });
    }
    if (!license.controlling_document_reference?.trim()) {
      flags.push({
        ruleCode: "LICENSE_MISSING_CONTROLLING_DOCUMENT",
        title: "No controlling document referenced",
        description: "This license has no reference to the document that governs it.",
        severity: "MODERATE",
        entityType: "license",
        entityId: license.id,
        evidenceContext: null,
        recommendedAction: "Add a reference to the controlling document or agreement.",
      });
    }
    if (license.status === "REVIEW_REQUIRED") {
      flags.push({
        ruleCode: "LICENSE_STATUS_REVIEW_REQUIRED",
        title: "License marked Review Required",
        description: "This license's status is REVIEW REQUIRED.",
        severity: "MODERATE",
        entityType: "license",
        entityId: license.id,
        evidenceContext: null,
        recommendedAction: "Review and resolve this license's status.",
      });
    }

    // Conflict: license grants AI/synthetic rights but the asset's own
    // default AI policy prohibits it.
    const asset = assetById.get(license.asset_id);
    if (
      asset &&
      license.ai_synthetic_rights_included === true &&
      asset.default_ai_policy === "PROHIBIT" &&
      (license.status === "ACTIVE" || license.status === "PENDING")
    ) {
      flags.push({
        ruleCode: "LICENSE_CONFLICTS_ASSET_AI_POLICY",
        title: `License conflicts with "${asset.name}"'s AI policy`,
        description:
          "This license includes AI/synthetic rights, but the asset's default AI policy is Prohibit.",
        severity: "HIGH",
        entityType: "license",
        entityId: license.id,
        evidenceContext: null,
        recommendedAction:
          "Reconcile the license terms with the asset's default AI policy — this is a conflict, not a legal determination.",
      });
    }
    // Conflict: asset's default license policy text says "contact for
    // license" but an exclusive license already exists.
    if (
      asset &&
      license.is_exclusive &&
      (license.status === "ACTIVE" || license.status === "PENDING") &&
      asset.default_license_policy?.toLowerCase().includes("contact_for_license".replace(/_/g, " "))
    ) {
      flags.push({
        ruleCode: "LICENSE_CONFLICTS_ASSET_DEFAULT_POLICY",
        title: `License conflicts with "${asset.name}"'s default license policy`,
        description:
          'The asset\'s default license policy says "contact for license," but an exclusive license already exists.',
        severity: "MODERATE",
        entityType: "license",
        entityId: license.id,
        evidenceContext: null,
        recommendedAction:
          "Reconcile the asset's stated default policy with the existing exclusive license.",
      });
    }
  }

  // Conflict: more than one live (ACTIVE/PENDING) exclusive license exists
  // on the same asset — flagged rather than silently overwritten or
  // silently allowed to coexist (Round 3.5 spec §D: "existing exclusive
  // license + proposed competing license -> flag").
  const exclusiveLicensesByAsset = new Map<string, typeof licenses>();
  for (const license of licenses) {
    if (!license.is_exclusive || (license.status !== "ACTIVE" && license.status !== "PENDING"))
      continue;
    const list = exclusiveLicensesByAsset.get(license.asset_id) ?? [];
    list.push(license);
    exclusiveLicensesByAsset.set(license.asset_id, list);
  }
  for (const [assetId, group] of exclusiveLicensesByAsset) {
    if (group.length < 2) continue;
    const asset = assetById.get(assetId);
    for (const license of group) {
      flags.push({
        ruleCode: "LICENSE_COMPETING_EXCLUSIVE",
        title: `Multiple exclusive licenses on "${asset?.name ?? "this asset"}"`,
        description:
          "More than one active or pending exclusive license exists for the same asset — these may conflict with each other.",
        severity: "HIGH",
        entityType: "license",
        entityId: license.id,
        evidenceContext: null,
        recommendedAction:
          "Review all exclusive licenses on this asset and resolve the conflict — this is a conflict flag, not a legal determination.",
      });
    }
  }

  // ---- EVIDENCE ----
  for (const ev of evidence) {
    if (ev.status === "DISPUTED") {
      flags.push({
        ruleCode: "EVIDENCE_DISPUTED",
        title: "Evidence marked disputed",
        description: "This evidence record's status is DISPUTED.",
        severity: "HIGH",
        entityType: "evidence",
        entityId: ev.id,
        evidenceContext: null,
        recommendedAction: "Review and resolve the dispute.",
      });
    }
    if (ev.status === "EXPIRED") {
      flags.push({
        ruleCode: "EVIDENCE_EXPIRED",
        title: "Evidence marked expired",
        description: "This evidence record's status is EXPIRED.",
        severity: "MODERATE",
        entityType: "evidence",
        entityId: ev.id,
        evidenceContext: null,
        recommendedAction: "Replace or renew this evidence if it's still relevant.",
      });
    }
    const parentAsset = assetById.get(ev.asset_id);
    if (ev.evidence_type === "IDENTITY_DOCUMENT" && parentAsset?.is_public) {
      flags.push({
        ruleCode: "EVIDENCE_IDENTITY_DOCUMENT_ON_PUBLIC_ASSET",
        title: "Identity document evidence on a public asset",
        description: "Identity-document evidence is attached to an asset marked public.",
        severity: "HIGH",
        entityType: "evidence",
        entityId: ev.id,
        evidenceContext: null,
        recommendedAction:
          "Confirm this evidence reference does not expose sensitive identity details publicly.",
      });
    }
  }

  // ---- VERSION / GOVERNANCE ----
  if (!passport.effective_date) {
    flags.push({
      ruleCode: "VERSION_MISSING_EFFECTIVE_DATE",
      title: "No effective date set",
      description: "This passport version has no effective date.",
      severity: "LOW",
      entityType: "passport",
      entityId: null,
      evidenceContext: null,
      recommendedAction: "Set an effective date in Passport Details.",
    });
  }
  if (
    passport.status === "ACTIVE" &&
    (!passport.public_professional_name?.trim() || !passport.rights_contact_email?.trim())
  ) {
    flags.push({
      ruleCode: "VERSION_ACTIVE_BUT_INCOMPLETE",
      title: "Active passport is missing core identity fields",
      description: "This passport is ACTIVE but core identity/contact fields are incomplete.",
      severity: "HIGH",
      entityType: "passport",
      entityId: null,
      evidenceContext: null,
      recommendedAction: "Complete the missing identity/contact fields.",
    });
  }

  // ---- LEGACY ----
  if (!passport.successor_estate_contact?.trim()) {
    flags.push({
      ruleCode: "LEGACY_NO_SUCCESSOR_CONTACT",
      title: "No successor/estate contact",
      description: "This passport has no successor or estate contact on record.",
      severity: "MODERATE",
      entityType: "passport",
      entityId: null,
      evidenceContext: null,
      recommendedAction: "Add successor/estate instructions in Passport Details.",
    });
  }
  if (!consentByUseCase.has("POSTHUMOUS_ESTATE_USE")) {
    flags.push({
      ruleCode: "LEGACY_NO_POSTHUMOUS_AI_DECLARATION",
      title: "No posthumous AI use declaration",
      description: "This passport has not declared a permission for posthumous/estate AI use.",
      severity: "MODERATE",
      entityType: "passport",
      entityId: null,
      evidenceContext: null,
      recommendedAction:
        "Declare a permission for posthumous/estate use in the AI Consent Builder.",
    });
  }
  if (!passport.review_frequency?.trim()) {
    flags.push({
      ruleCode: "LEGACY_NO_REVIEW_FREQUENCY",
      title: "No review frequency set",
      description: "This passport has no stated review frequency.",
      severity: "LOW",
      entityType: "passport",
      entityId: null,
      evidenceContext: null,
      recommendedAction: "Set how often this passport should be reviewed.",
    });
  }

  return flags;
}
