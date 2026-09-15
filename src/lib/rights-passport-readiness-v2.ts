/**
 * AurumVault Digital Rights Readiness Score™ v2 — pure, dependency-free,
 * scored from real records (assets, AI consent, licenses, evidence, review
 * flags) rather than v1's identity-only heuristic
 * (rights-passport-readiness.ts, kept unchanged — still used nowhere else
 * once Passport Home is wired to v2, but its own tests keep passing).
 *
 * Like the risk-rule engine, this is a completeness/gap indicator, never a
 * legal determination. A high score means "well-organized and declared,"
 * not "legally verified" or "guaranteed enforceable."
 */
import type { PassportRow, AssetRow, VerificationLevel } from "@/lib/rights-passport.schema";
import type {
  AiConsentRow,
  LicenseRow,
  EvidenceRow,
  AiUseCase,
} from "@/lib/rights-passport-workspace.schema";
import type { RiskFlag } from "@/lib/rights-passport-risk-rules";

// Duplicated from rights-passport-workspace.schema.ts for the same
// pure-module reason documented in rights-passport-risk-rules.ts.
const TOTAL_AI_USE_CASES = 22;
const HIGH_RISK_AI_USE_CASES: AiUseCase[] = [
  "VOICE_CLONE",
  "DIGITAL_REPLICA",
  "GENERATED_ADVERTISEMENT",
  "COMMERCIAL_MODEL_OUTPUT",
  "POSTHUMOUS_ESTATE_USE",
];

export type ReadinessStatus =
  | "HIGH_RIGHTS_EXPOSURE"
  | "INCOMPLETE"
  | "CONTROLLED_WITH_GAPS"
  | "PUBLISH_READY";

export const READINESS_STATUS_LABELS: Record<ReadinessStatus, string> = {
  HIGH_RIGHTS_EXPOSURE: "High Rights Exposure",
  INCOMPLETE: "Incomplete",
  CONTROLLED_WITH_GAPS: "Controlled With Gaps",
  PUBLISH_READY: "Publish Ready",
};

export type ReadinessDimension = {
  id: string;
  label: string;
  weight: number;
  earned: number; // 0..weight
  gap: string | null;
};

export type ReadinessResultV2 = {
  score: number; // 0-100
  status: ReadinessStatus;
  dimensions: ReadinessDimension[];
  primaryGap: string | null;
  recommendedNextMove: string;
  openReviewFlags: number;
  publishBlocked: boolean;
  blockers: string[];
};

export type ReadinessInputV2 = {
  passport: Pick<
    PassportRow,
    | "public_professional_name"
    | "rights_contact_email"
    | "verification_level"
    | "successor_estate_contact"
    | "effective_date"
    | "review_frequency"
  >;
  assets: Pick<AssetRow, "id" | "status" | "control_basis">[];
  aiConsents: Pick<AiConsentRow, "use_case" | "asset_id" | "permission">[];
  licenses: Pick<LicenseRow, "id" | "status">[];
  evidence: Pick<EvidenceRow, "id" | "asset_id" | "status">[];
  /** Flags currently OPEN or ACKNOWLEDGED — RESOLVED/ACCEPTED_RISK excluded by the caller. */
  openFlags: Pick<RiskFlag, "ruleCode" | "severity">[];
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function computeReadinessScoreV2(input: ReadinessInputV2): ReadinessResultV2 {
  const { passport, assets, aiConsents, licenses, evidence, openFlags } = input;
  const activeAssets = assets.filter((a) => a.status !== "ARCHIVED");
  const dimensions: ReadinessDimension[] = [];

  // ---- Identity & Contact — 15 ----
  {
    const weight = 15;
    let fraction = 0;
    const gaps: string[] = [];
    if (passport.public_professional_name?.trim()) fraction += 0.4;
    else gaps.push("Add your public/professional name");
    if (passport.rights_contact_email?.trim()) fraction += 0.4;
    else gaps.push("Add a rights contact email");
    if ((passport.verification_level as VerificationLevel) !== "SELF_DECLARED") fraction += 0.2;
    else gaps.push("Raise your verification level beyond self-declared");
    dimensions.push({
      id: "identity",
      label: "Identity & Contact",
      weight,
      earned: clamp01(fraction) * weight,
      gap: gaps[0] ?? null,
    });
  }

  // ---- Rights Asset Registry — 20 ----
  {
    const weight = 20;
    let fraction = 0;
    const gaps: string[] = [];
    if (activeAssets.length > 0) fraction += 0.6;
    else gaps.push("Register at least one asset");
    const disputedOrReview = activeAssets.filter(
      (a) => a.status === "DISPUTED" || a.control_basis === "REVIEW_REQUIRED",
    ).length;
    if (activeAssets.length > 0) {
      const cleanFraction = 1 - disputedOrReview / activeAssets.length;
      fraction += 0.4 * clamp01(cleanFraction);
      if (disputedOrReview > 0) gaps.push("Resolve disputed or unresolved-control assets");
    }
    dimensions.push({
      id: "assets",
      label: "Rights Asset Registry",
      weight,
      earned: clamp01(fraction) * weight,
      gap: gaps[0] ?? null,
    });
  }

  // ---- AI Consent Coverage — 20 ----
  {
    const weight = 20;
    const passportWideUseCases = new Set(
      aiConsents.filter((c) => !c.asset_id).map((c) => c.use_case),
    );
    const declaredFraction = clamp01(passportWideUseCases.size / TOTAL_AI_USE_CASES);
    const highRiskDeclared = HIGH_RISK_AI_USE_CASES.filter((u) =>
      passportWideUseCases.has(u),
    ).length;
    const highRiskFraction = clamp01(highRiskDeclared / HIGH_RISK_AI_USE_CASES.length);
    // Coverage of all use cases matters, but high-risk coverage matters more.
    const fraction = 0.5 * declaredFraction + 0.5 * highRiskFraction;
    const gaps: string[] = [];
    if (highRiskDeclared < HIGH_RISK_AI_USE_CASES.length) {
      gaps.push("Declare a permission for every high-risk AI use case");
    } else if (declaredFraction < 1) {
      gaps.push("Declare permissions for the remaining AI use cases");
    }
    dimensions.push({
      id: "ai_consent",
      label: "AI Consent Coverage",
      weight,
      earned: clamp01(fraction) * weight,
      gap: gaps[0] ?? null,
    });
  }

  // ---- License Conflict Control — 10 ----
  {
    const weight = 10;
    let fraction = 1; // no licenses at all isn't itself a problem
    const gaps: string[] = [];
    if (licenses.length > 0) {
      const conflictFlags = openFlags.filter((f) => f.ruleCode.startsWith("LICENSE_"));
      fraction = clamp01(1 - conflictFlags.length / Math.max(licenses.length, 1));
      if (conflictFlags.length > 0) gaps.push("Resolve open license conflicts or gaps");
    }
    dimensions.push({
      id: "licenses",
      label: "License Conflict Control",
      weight,
      earned: clamp01(fraction) * weight,
      gap: gaps[0] ?? null,
    });
  }

  // ---- Evidence & Provenance — 15 ----
  {
    const weight = 15;
    let fraction = 0;
    const gaps: string[] = [];
    if (activeAssets.length === 0) {
      fraction = 0;
      gaps.push("Register assets, then attach supporting evidence");
    } else {
      const assetsWithEvidence = activeAssets.filter((a) =>
        evidence.some((e) => e.asset_id === a.id),
      ).length;
      const coverageFraction = assetsWithEvidence / activeAssets.length;
      const problemEvidence = evidence.filter(
        (e) => e.status === "DISPUTED" || e.status === "EXPIRED",
      ).length;
      const cleanFraction = evidence.length ? clamp01(1 - problemEvidence / evidence.length) : 1;
      fraction = 0.7 * coverageFraction + 0.3 * cleanFraction;
      if (coverageFraction < 1) gaps.push("Attach evidence to every registered asset");
      else if (problemEvidence > 0) gaps.push("Resolve disputed or expired evidence records");
    }
    dimensions.push({
      id: "evidence",
      label: "Evidence & Provenance",
      weight,
      earned: clamp01(fraction) * weight,
      gap: gaps[0] ?? null,
    });
  }

  // ---- Version / Change Control — 10 ----
  {
    const weight = 10;
    let fraction = 0;
    const gaps: string[] = [];
    if (passport.effective_date) fraction += 0.5;
    else gaps.push("Set an effective date");
    if (passport.review_frequency?.trim()) fraction += 0.5;
    else gaps.push("Set a review frequency");
    dimensions.push({
      id: "version",
      label: "Version / Change Control",
      weight,
      earned: clamp01(fraction) * weight,
      gap: gaps[0] ?? null,
    });
  }

  // ---- Legacy / Successor — 10 ----
  {
    const weight = 10;
    let fraction = 0;
    const gaps: string[] = [];
    if (passport.successor_estate_contact?.trim()) fraction += 0.5;
    else gaps.push("Add a successor/estate contact");
    const posthumousDeclared = aiConsents.some(
      (c) => !c.asset_id && c.use_case === "POSTHUMOUS_ESTATE_USE",
    );
    if (posthumousDeclared) fraction += 0.5;
    else gaps.push("Declare a posthumous/estate AI use permission");
    dimensions.push({
      id: "legacy",
      label: "Legacy / Successor",
      weight,
      earned: clamp01(fraction) * weight,
      gap: gaps[0] ?? null,
    });
  }

  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
  const totalEarned = dimensions.reduce((s, d) => s + d.earned, 0);
  let score = Math.round((totalEarned / totalWeight) * 100);

  // A passport with literally nothing filled in caps at 20, regardless of
  // rounding on the dimension math above.
  const isBlank =
    !passport.public_professional_name?.trim() &&
    !passport.rights_contact_email?.trim() &&
    activeAssets.length === 0 &&
    aiConsents.length === 0;
  if (isBlank) score = Math.min(score, 20);

  const openCritical = openFlags.filter((f) => f.severity === "CRITICAL").length;
  const highRiskUndeclared =
    HIGH_RISK_AI_USE_CASES.length -
    HIGH_RISK_AI_USE_CASES.filter((u) => aiConsents.some((c) => !c.asset_id && c.use_case === u))
      .length;
  const unresolvedControl = activeAssets.some((a) => a.control_basis === "REVIEW_REQUIRED");

  const blockers: string[] = [];
  if (activeAssets.length === 0) blockers.push("No assets registered");
  if (highRiskUndeclared > 0)
    blockers.push(`${highRiskUndeclared} high-risk AI use(s) not declared`);
  if (openCritical > 0) blockers.push(`${openCritical} CRITICAL open review flag(s)`);
  if (unresolvedControl)
    blockers.push("Unresolved ownership/control (REVIEW REQUIRED) on an asset");
  if (!passport.rights_contact_email?.trim()) blockers.push("Missing public rights contact");

  const publishBlocked = blockers.length > 0;

  let status: ReadinessStatus;
  if (score >= 90 && !publishBlocked) status = "PUBLISH_READY";
  else if (score >= 90 && publishBlocked) status = "CONTROLLED_WITH_GAPS";
  else if (score >= 75) status = "CONTROLLED_WITH_GAPS";
  else if (score >= 50) status = "INCOMPLETE";
  else status = "HIGH_RIGHTS_EXPOSURE";

  const sortedByGapImpact = [...dimensions]
    .filter((d) => d.gap)
    .sort((a, b) => b.weight - a.weight - (a.earned - b.earned));
  const primaryGap = blockers[0] ?? sortedByGapImpact[0]?.gap ?? null;
  const recommendedNextMove =
    primaryGap ?? "Your passport is in good standing — review it periodically.";

  return {
    score: Math.max(0, Math.min(100, score)),
    status,
    dimensions,
    primaryGap,
    recommendedNextMove,
    openReviewFlags: openFlags.length,
    publishBlocked,
    blockers,
  };
}
