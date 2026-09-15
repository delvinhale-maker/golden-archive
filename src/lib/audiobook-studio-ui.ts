/**
 * AurumVault Audiobook Studio — Phase 3 pure UI helpers.
 *
 * Deliberately dependency-free (no React, no Supabase, no server imports) so
 * the workflow rules the creator UI depends on are unit-testable and cannot
 * drift from the truthful Phase 2 domain layer.
 *
 * TRUTHFULNESS RULES ENCODED HERE:
 * - Mock narration is always labelled as placeholder audio.
 * - A package containing mock audio is only ever offered as a clearly marked
 *   workflow-test export, never as a distributable deliverable.
 * - A metadata suggestion is never applied implicitly: `applyMetadataSuggestion`
 *   requires an explicit list of fields the creator chose.
 */
import type { AudiobookReadinessState } from "@/lib/audiobook-readiness";

export type AudiobookStepId =
  | "project"
  | "manuscript"
  | "chapters"
  | "narration"
  | "review"
  | "qc"
  | "metadata"
  | "readiness";

export type AudiobookStep = { id: AudiobookStepId; label: string; hint: string };

export const AUDIOBOOK_STEPS: AudiobookStep[] = [
  { id: "project", label: "Project", hint: "Name the work and its author" },
  { id: "manuscript", label: "Manuscript", hint: "Upload TXT, DOCX, EPUB or a clean PDF" },
  { id: "chapters", label: "Chapters", hint: "Review parsed chapters and narration edits" },
  { id: "narration", label: "Voice / Narration", hint: "Pronunciations, estimates, generation" },
  { id: "review", label: "Review", hint: "Listen and choose the accepted take" },
  { id: "qc", label: "QC", hint: "Run quality control checks" },
  { id: "metadata", label: "Metadata & Rights", hint: "Cataloguing details and rights" },
  { id: "readiness", label: "Readiness / Export", hint: "Blockers and package export" },
];

export type StepStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export type WorkflowState = {
  hasProject: boolean;
  sourceCount: number;
  parsedSourceCount: number;
  chapterCount: number;
  chaptersWithAudio: number;
  pronunciationCount: number;
  rightsAttested: boolean;
  qcResult: "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED" | null;
  metadataComplete: boolean;
  readinessState: AudiobookReadinessState | null;
};

export function deriveStepStatuses(state: WorkflowState): Record<AudiobookStepId, StepStatus> {
  const chaptersDone = state.chapterCount > 0;
  const audioDone = chaptersDone && state.chaptersWithAudio >= state.chapterCount;
  return {
    project: state.hasProject ? "DONE" : "TODO",
    manuscript:
      state.parsedSourceCount > 0 ? "DONE" : state.sourceCount > 0 ? "IN_PROGRESS" : "TODO",
    chapters: chaptersDone ? "DONE" : "TODO",
    narration: !state.rightsAttested
      ? "BLOCKED"
      : audioDone
        ? "DONE"
        : state.chaptersWithAudio > 0
          ? "IN_PROGRESS"
          : "TODO",
    review: audioDone ? "DONE" : state.chaptersWithAudio > 0 ? "IN_PROGRESS" : "TODO",
    qc: state.qcResult === null ? "TODO" : state.qcResult === "FAILED" ? "BLOCKED" : "DONE",
    metadata: state.metadataComplete && state.rightsAttested ? "DONE" : "IN_PROGRESS",
    readiness:
      state.readinessState === "DISTRIBUTION_ELIGIBLE" || state.readinessState === "DISTRIBUTED"
        ? "DONE"
        : state.readinessState === "PRODUCTION_READY"
          ? "IN_PROGRESS"
          : "TODO",
  };
}

export const MOCK_NARRATION_BADGE = "MOCK / PLACEHOLDER NARRATION";

export const MOCK_NARRATION_EXPLANATION =
  "This audio is a deterministic placeholder tone, not speech. It exists to test the workflow end to end and can never be treated as narration-ready audio.";

export const MOCK_PACKAGE_WARNING =
  "This package contains placeholder narration. It is a workflow-test export only — it is NOT distributable and must not be delivered to a retailer, listener or distributor.";

export const RIGHTS_CONFIRMATION_LABEL =
  "I confirm I own or control the audio/narration rights to this work, that I am authorised to create a synthetic-voice recording of it, and that I accept responsibility for this attestation.";

export const RIGHTS_REVOKE_WARNING =
  "Revoking this attestation immediately blocks narration and export for this project until you attest again.";

export const IMMUTABLE_SOURCE_WARNING =
  "Parsed chapter text is immutable. Narration edits are saved as new versions — the original manuscript text is never overwritten. A project can only be parsed once.";

export type ExportDecision = {
  allowed: boolean;
  /** True when the export may only be presented as a marked test package. */
  testOnly: boolean;
  reason: string | null;
};

export function evaluateExportAvailability(input: {
  audioAssetCount: number;
  hasMockAudio: boolean;
}): ExportDecision {
  if (input.audioAssetCount <= 0) {
    return {
      allowed: false,
      testOnly: false,
      reason: "There is no accepted audio to export yet. Generate narration first.",
    };
  }
  if (input.hasMockAudio) {
    return { allowed: true, testOnly: true, reason: MOCK_PACKAGE_WARNING };
  }
  return { allowed: true, testOnly: false, reason: null };
}

export function canGenerateNarration(input: { rightsAttested: boolean; chapterCount: number }): {
  allowed: boolean;
  reason: string | null;
} {
  if (input.chapterCount <= 0) {
    return { allowed: false, reason: "Parse a manuscript before generating narration." };
  }
  if (!input.rightsAttested) {
    return {
      allowed: false,
      reason: "Confirm your narration rights in Metadata & Rights before generating audio.",
    };
  }
  return { allowed: true, reason: null };
}

export const READINESS_LABELS: Record<AudiobookReadinessState, string> = {
  NOT_READY: "Not ready",
  PRODUCTION_READY: "Production ready",
  DISTRIBUTION_ELIGIBLE: "Distribution eligible",
  DISTRIBUTED: "Distributed",
};

export const READINESS_TONES: Record<AudiobookReadinessState, string> = {
  NOT_READY: "bg-amber-50 text-amber-700 border-amber-200",
  PRODUCTION_READY: "bg-sky-50 text-sky-700 border-sky-200",
  DISTRIBUTION_ELIGIBLE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DISTRIBUTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export type MetadataDraft = {
  title: string;
  subtitle: string;
  authorName: string;
  narratorName: string;
  publisher: string;
  description: string;
  language: string;
  isbn: string;
  genre: string;
  copyrightYear: string;
};

export type MetadataSuggestion = {
  title: string | null;
  subtitle: string | null;
  description: string | null;
  language: string | null;
};

export type SuggestibleField = "title" | "subtitle" | "description" | "language";

/**
 * Applies ONLY the fields the creator explicitly selected. Called with an empty
 * selection it returns the draft unchanged — a suggestion can never silently
 * mutate metadata.
 */
export function applyMetadataSuggestion(
  draft: MetadataDraft,
  suggestion: MetadataSuggestion,
  fields: SuggestibleField[],
): MetadataDraft {
  const next = { ...draft };
  for (const field of fields) {
    const value = suggestion[field];
    if (typeof value === "string" && value.trim().length > 0) next[field] = value;
  }
  return next;
}

/** Strips storage paths, buckets and stack noise out of a server error. */
export function safeErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ((error as { message?: unknown } | null)?.message as string | undefined) ?? "";
  const message = (raw ?? "").trim();
  if (message.length === 0) return fallback;
  if (/audiobook-(manuscripts|audio)|storage\/v1|supabase|https?:\/\//i.test(message)) {
    return fallback;
  }
  return message.slice(0, 300);
}