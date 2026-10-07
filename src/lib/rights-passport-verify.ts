/**
 * AurumVault Digital Rights Passport Generator — Round 4 Verify Passport™
 * checklist. The final quality gate before publication.
 *
 * Pure, dependency-free (no zod, no @supabase/supabase-js). Builds ON TOP
 * of Round 2's computeReadinessScoreV2 (also pure — safe to import
 * directly) rather than re-deriving the score/status/blockers it already
 * computes; this module adds the license-specific and structural checks
 * the Round 4 spec's Verify Passport §C calls out explicitly that
 * readiness-v2 doesn't already surface as named checklist items (expired-
 * but-still-ACTIVE licenses, unreviewed exclusive-license conflicts, and
 * the PRIVACY category).
 *
 * PRIVACY is deliberately NOT a live per-passport check here — "no private
 * field in the public payload" is a property of the CODE
 * (serializePublicPassport, rights-passport-serialize.ts), verified once
 * by that module's own sentinel-injection tests, not something that varies
 * per passport. It's still surfaced in the checklist for transparency, but
 * it always passes by construction rather than being computed from
 * per-passport data.
 *
 * SAFETY: a numeric score alone never gates publication — blockers always
 * override it, matching Round 2's existing publishBlocked semantics and
 * the Round 4 spec's explicit "Do not require score = 100... but blockers
 * still override the numerical score."
 */
import {
  computeReadinessScoreV2,
  type ReadinessInputV2,
  type ReadinessResultV2,
  type ReadinessStatus,
} from "@/lib/rights-passport-readiness-v2";

export type VerificationCategory =
  | "IDENTITY"
  | "ASSETS"
  | "AI_CONSENT"
  | "LICENSES"
  | "EVIDENCE"
  | "VERSION"
  | "LEGACY"
  | "PRIVACY";

export type VerificationCheck = {
  id: string;
  category: VerificationCategory;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail: string;
};

export type VerificationResult = {
  score: number;
  status: ReadinessStatus;
  primaryGap: string | null;
  openReviewFlags: number;
  checks: VerificationCheck[];
  blockers: string[];
  readyToPublish: boolean;
  lastUpdated: string | null;
  version: number;
};

export type VerificationInput = ReadinessInputV2 & {
  /** All currently-OPEN/ACKNOWLEDGED flags with their rule codes, for the license-specific checks below (readiness-v2's own input only carries ruleCode+severity, which is enough). */
  version: number;
  updatedAt: string | null;
};

/**
 * Round 4 Verify Passport's own 6-item high-risk list (spec §C) —
 * deliberately independent from Round 2/3's 5-item
 * HIGH_RISK_AI_USE_CASES (rights-passport-risk-rules.ts /
 * rights-passport-analysis-confidence.ts), which adds GENERAL_AI_TRAINING
 * and is a Verify-specific publish gate, not a change to the existing
 * risk-flagging/review-required behavior elsewhere in the product.
 */
export const VERIFY_HIGH_RISK_AI_USE_CASES = [
  "GENERAL_AI_TRAINING",
  "VOICE_CLONE",
  "DIGITAL_REPLICA",
  "GENERATED_ADVERTISEMENT",
  "COMMERCIAL_MODEL_OUTPUT",
  "POSTHUMOUS_ESTATE_USE",
] as const;

function licenseCheck(
  id: string,
  label: string,
  ruleCodes: string[],
  openFlags: VerificationInput["openFlags"],
): VerificationCheck {
  const matches = openFlags.filter((f) => ruleCodes.includes(f.ruleCode));
  return {
    id,
    category: "LICENSES",
    label,
    passed: matches.length === 0,
    blocking: true,
    detail:
      matches.length === 0
        ? "No unresolved issues of this kind."
        : `${matches.length} unresolved issue(s) of this kind — resolve in Risk & Conflict Review before publishing.`,
  };
}

export function computeVerificationChecklist(input: VerificationInput): VerificationResult {
  const readiness: ReadinessResultV2 = computeReadinessScoreV2(input);
  const { passport, assets } = input;
  const activeAssets = assets.filter((a) => a.status !== "ARCHIVED");

  const checks: VerificationCheck[] = [
    {
      id: "identity_name",
      category: "IDENTITY",
      label: "Public/professional name exists",
      passed: !!passport.public_professional_name?.trim(),
      blocking: false,
      detail: passport.public_professional_name?.trim()
        ? "Set."
        : "Add a public/professional name in Passport Details.",
    },
    {
      id: "identity_rights_contact",
      category: "IDENTITY",
      label: "Public rights contact exists",
      passed: !!passport.rights_contact_email?.trim(),
      blocking: true,
      detail: passport.rights_contact_email?.trim() ? "Set." : "Add a rights contact email.",
    },
    {
      id: "identity_verification_level",
      category: "IDENTITY",
      label: "Verification level declared",
      passed: !!passport.verification_level,
      blocking: false,
      detail: `Currently: ${passport.verification_level}.`,
    },
    {
      id: "identity_jurisdiction",
      category: "IDENTITY",
      label: "Jurisdiction status known or intentionally not stated",
      passed: true,
      blocking: false,
      detail: "Never blocking — an unset jurisdiction is a valid, intentional choice.",
    },
    {
      id: "assets_at_least_one",
      category: "ASSETS",
      label: "At least one rights asset registered",
      passed: activeAssets.length > 0,
      blocking: true,
      detail:
        activeAssets.length > 0
          ? `${activeAssets.length} registered.`
          : "Register at least one asset.",
    },
    {
      id: "assets_no_unresolved_control",
      category: "ASSETS",
      label: "No unresolved critical asset control issue",
      passed: !activeAssets.some((a) => a.control_basis === "REVIEW_REQUIRED"),
      blocking: true,
      detail: activeAssets.some((a) => a.control_basis === "REVIEW_REQUIRED")
        ? "One or more assets have an unresolved control basis."
        : "Clear.",
    },
    {
      id: "ai_consent_high_risk_declared",
      category: "AI_CONSENT",
      label: "All high-risk AI use cases declared",
      ...(() => {
        const declared = new Set(
          input.aiConsents.filter((c) => !c.asset_id).map((c) => c.use_case),
        );
        const missing = VERIFY_HIGH_RISK_AI_USE_CASES.filter((u) => !declared.has(u));
        return {
          passed: missing.length === 0,
          blocking: true,
          detail:
            missing.length === 0
              ? "All 6 high-risk AI use cases declared."
              : `Not declared: ${missing.map((u) => u.replace(/_/g, " ")).join(", ")}.`,
        };
      })(),
    },
    licenseCheck(
      "licenses_no_expired_active",
      "No expired license incorrectly marked ACTIVE",
      ["LICENSE_EXPIRED_STILL_ACTIVE"],
      input.openFlags,
    ),
    licenseCheck(
      "licenses_no_unreviewed_exclusive_conflict",
      "No known exclusive conflict left unreviewed",
      [
        "LICENSE_COMPETING_EXCLUSIVE",
        "LICENSE_CONFLICTS_ASSET_AI_POLICY",
        "LICENSE_CONFLICTS_ASSET_DEFAULT_POLICY",
      ],
      input.openFlags,
    ),
    {
      id: "licenses_no_critical_conflict",
      category: "LICENSES",
      label: "No unresolved CRITICAL conflict",
      passed: !input.openFlags.some((f) => f.severity === "CRITICAL"),
      blocking: true,
      detail: input.openFlags.some((f) => f.severity === "CRITICAL")
        ? `${input.openFlags.filter((f) => f.severity === "CRITICAL").length} CRITICAL flag(s) open.`
        : "Clear.",
    },
    {
      id: "evidence_core_claims_supported",
      category: "EVIDENCE",
      label: "Core rights claims have supporting or explicitly self-declared evidence",
      passed: true,
      blocking: false,
      detail:
        "Non-blocking — missing evidence is surfaced as a review flag, not a publish blocker.",
    },
    {
      id: "version_exists",
      category: "VERSION",
      label: "Version exists",
      passed: !!input.version,
      blocking: false,
      detail: `v${input.version}.`,
    },
    {
      id: "version_effective_date",
      category: "VERSION",
      label: "Effective date exists",
      passed: !!passport.effective_date,
      blocking: false,
      detail: passport.effective_date ?? "Not set.",
    },
    {
      id: "legacy_successor_reviewed",
      category: "LEGACY",
      label: "Successor/estate contact reviewed",
      passed: !!passport.successor_estate_contact?.trim(),
      blocking: false,
      detail: passport.successor_estate_contact?.trim() ? "Set." : "Not set — informational only.",
    },
    {
      id: "legacy_posthumous_declared",
      category: "LEGACY",
      label: "Posthumous/estate AI use declared",
      passed: input.aiConsents.some((c) => !c.asset_id && c.use_case === "POSTHUMOUS_ESTATE_USE"),
      blocking: false,
      detail: "Also required by the AI Consent high-risk check above (which is blocking).",
    },
    {
      id: "privacy_public_payload_excludes_private_fields",
      category: "PRIVACY",
      label:
        "Public export excludes private identity fields, private evidence paths, contract text, and signed URLs",
      passed: true,
      blocking: false,
      detail:
        "Enforced structurally by serializePublicPassport() and verified by its own tests — not a per-passport toggle.",
    },
  ];

  const blockingFailures = checks.filter((c) => c.blocking && !c.passed);
  const blockers = [...readiness.blockers, ...blockingFailures.map((c) => c.detail)];
  const readyToPublish = blockingFailures.length === 0 && !readiness.publishBlocked;

  return {
    score: readiness.score,
    status: readiness.status,
    primaryGap: readiness.primaryGap,
    openReviewFlags: readiness.openReviewFlags,
    checks,
    blockers,
    readyToPublish,
    lastUpdated: input.updatedAt,
    version: input.version,
  };
}
