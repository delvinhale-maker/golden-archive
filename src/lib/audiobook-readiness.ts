/**
 * AurumVault Audiobook Studio — Phase 2 truthful readiness engine.
 *
 * Pure and dependency-free. The single rule this module exists to enforce:
 * NEVER claim more than the persisted evidence supports.
 *
 * - Mock narration can never be PRODUCTION_READY or DISTRIBUTION_ELIGIBLE.
 * - DISTRIBUTED requires an explicit completed distributor connector record —
 *   it is never inferred from readiness, packaging or export.
 * - Distributor-specific compatibility is reported separately from generic
 *   readiness so a distributor rule change can never silently flip readiness.
 */
import { evaluateAudiobookMetadata, type AudiobookMetadataInput } from "@/lib/audiobook-metadata";
import { evaluateRightsAttestation, type RightsAttestationInput } from "@/lib/audiobook-rights";

export type AudiobookReadinessState =
  | "NOT_READY"
  | "PRODUCTION_READY"
  | "DISTRIBUTION_ELIGIBLE"
  | "DISTRIBUTED";

export type ReadinessBlocker = { code: string; message: string };

export type DistributorDelivery = {
  distributor: string;
  /** Only an explicit connector completion may set this. */
  status: "NOT_STARTED" | "IN_PROGRESS" | "FAILED" | "COMPLETED";
  completedAt?: string | null;
  externalReference?: string | null;
};

export type ReadinessInput = {
  metadata?: AudiobookMetadataInput | null;
  rights?: RightsAttestationInput | null;
  chapterCount?: number;
  chaptersWithCurrentAudio?: number;
  /** True when ANY current audio asset came from the mock provider. */
  hasMockAudio?: boolean;
  /** Latest persisted QC run outcome, if any. */
  qcOverallResult?: "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED" | null;
  /** Explicit distributor delivery records only. */
  deliveries?: DistributorDelivery[];
};

export type DistributorCompatibility = {
  distributor: string;
  compatible: boolean;
  issues: ReadinessBlocker[];
};

export type ReadinessEvaluation = {
  state: AudiobookReadinessState;
  blockers: ReadinessBlocker[];
  warnings: ReadinessBlocker[];
  /** Reported separately — never folded into `state`. */
  distributorCompatibility: DistributorCompatibility[];
  evidence: {
    metadataComplete: boolean;
    rightsAttested: boolean;
    audioCoverageComplete: boolean;
    qcPassed: boolean;
    mockAudioPresent: boolean;
    completedDeliveries: number;
  };
};

/** Distributor rules kept intentionally minimal and separate from readiness. */
const DISTRIBUTOR_RULES: Array<{
  distributor: string;
  check: (input: ReadinessInput) => ReadinessBlocker[];
}> = [
  {
    distributor: "generic-retail",
    check: (input) => {
      const issues: ReadinessBlocker[] = [];
      const meta = input.metadata ?? {};
      if (!meta.isbn || meta.isbn.trim().length === 0) {
        issues.push({ code: "DIST_ISBN_MISSING", message: "This distributor requires an ISBN." });
      }
      if (!meta.publisher || meta.publisher.trim().length === 0) {
        issues.push({ code: "DIST_PUBLISHER_MISSING", message: "This distributor requires a publisher." });
      }
      return issues;
    },
  },
];

export function evaluateAudiobookReadiness(input: ReadinessInput): ReadinessEvaluation {
  const blockers: ReadinessBlocker[] = [];
  const warnings: ReadinessBlocker[] = [];

  const metaEval = evaluateAudiobookMetadata(input.metadata ?? {});
  for (const b of metaEval.blockers) blockers.push({ code: b.code, message: b.message });
  for (const w of metaEval.warnings) warnings.push({ code: w.code, message: w.message });

  const rightsEval = evaluateRightsAttestation(input.rights);
  for (const b of rightsEval.blockers) blockers.push({ code: b.code, message: b.message });
  for (const w of rightsEval.warnings) warnings.push({ code: w.code, message: w.message });

  const chapterCount = input.chapterCount ?? 0;
  const covered = input.chaptersWithCurrentAudio ?? 0;
  const audioCoverageComplete = chapterCount > 0 && covered >= chapterCount;
  if (chapterCount === 0) {
    blockers.push({ code: "READY_NO_CHAPTERS", message: "This project has no chapters yet." });
  } else if (!audioCoverageComplete) {
    blockers.push({ code: "READY_AUDIO_INCOMPLETE", message: `Only ${covered} of ${chapterCount} chapters have accepted audio.` });
  }

  const qcPassed = input.qcOverallResult === "PASSED" || input.qcOverallResult === "PASSED_WITH_WARNINGS";
  if (!input.qcOverallResult) {
    blockers.push({ code: "READY_QC_NOT_RUN", message: "Quality control has not been run yet." });
  } else if (input.qcOverallResult === "FAILED") {
    blockers.push({ code: "READY_QC_FAILED", message: "The latest quality-control run failed." });
  } else if (input.qcOverallResult === "PASSED_WITH_WARNINGS") {
    warnings.push({ code: "READY_QC_WARNINGS", message: "Quality control passed with warnings worth reviewing." });
  }

  const mockAudioPresent = input.hasMockAudio === true;
  if (mockAudioPresent) {
    blockers.push({
      code: "READY_MOCK_NARRATION",
      message: "This project contains mock (placeholder) narration. Mock audio is never production-ready or distributable.",
    });
  }

  const deliveries = input.deliveries ?? [];
  const completedDeliveries = deliveries.filter((d) => d.status === "COMPLETED" && !!d.completedAt).length;
  const productionReady = blockers.length === 0;
  const distributorCompatibility: DistributorCompatibility[] = DISTRIBUTOR_RULES.map((rule) => {
    const issues = rule.check(input);
    return { distributor: rule.distributor, compatible: issues.length === 0, issues };
  });

  let state: AudiobookReadinessState = "NOT_READY";
  if (productionReady) {
    state = "PRODUCTION_READY";
    if (distributorCompatibility.some((d) => d.compatible)) state = "DISTRIBUTION_ELIGIBLE";
    if (completedDeliveries > 0) state = "DISTRIBUTED";
  }

  return {
    state,
    blockers,
    warnings,
    distributorCompatibility,
    evidence: {
      metadataComplete: metaEval.isComplete,
      rightsAttested: rightsEval.attested,
      audioCoverageComplete,
      qcPassed,
      mockAudioPresent,
      completedDeliveries,
    },
  };
}