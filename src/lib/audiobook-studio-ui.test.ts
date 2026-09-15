/**
 * AurumVault Audiobook Studio — Phase 3 UI rule tests.
 *
 * Covers only the rules the creator UI must not get wrong: fail-closed client
 * visibility, workflow status derivation, explicit metadata suggestion apply,
 * mock/export truthfulness, and error-message redaction.
 */
import { describe, it, expect } from "vitest";
import { isAudiobookStudioEnabledClient } from "@/lib/audiobook-feature-flags";
import {
  AUDIOBOOK_STEPS,
  MOCK_PACKAGE_WARNING,
  applyMetadataSuggestion,
  canGenerateNarration,
  deriveStepStatuses,
  evaluateExportAvailability,
  safeErrorMessage,
  type MetadataDraft,
  type WorkflowState,
} from "@/lib/audiobook-studio-ui";

const baseState: WorkflowState = {
  hasProject: true,
  sourceCount: 0,
  parsedSourceCount: 0,
  chapterCount: 0,
  chaptersWithAudio: 0,
  pronunciationCount: 0,
  rightsAttested: false,
  qcResult: null,
  metadataComplete: false,
  readinessState: null,
};

const draft: MetadataDraft = {
  title: "Existing title",
  subtitle: "",
  authorName: "",
  narratorName: "",
  publisher: "",
  description: "",
  language: "en",
  isbn: "",
  genre: "",
  copyrightYear: "",
};

describe("client feature flag", () => {
  it("is hidden by default when unset", () => {
    expect(isAudiobookStudioEnabledClient({})).toBe(false);
  });

  it("stays hidden for unexpected values", () => {
    expect(isAudiobookStudioEnabledClient({ VITE_AUDIOBOOK_STUDIO_ENABLED: "yes" })).toBe(false);
    expect(isAudiobookStudioEnabledClient({ VITE_AUDIOBOOK_STUDIO_ENABLED: "" })).toBe(false);
  });

  it("renders only for an explicit true", () => {
    expect(isAudiobookStudioEnabledClient({ VITE_AUDIOBOOK_STUDIO_ENABLED: "true" })).toBe(true);
  });
});

describe("workflow step derivation", () => {
  it("exposes the full eight-step journey", () => {
    expect(AUDIOBOOK_STEPS.map((s) => s.id)).toEqual([
      "project",
      "manuscript",
      "chapters",
      "narration",
      "review",
      "qc",
      "metadata",
      "readiness",
    ]);
  });

  it("blocks narration until rights are attested", () => {
    const statuses = deriveStepStatuses({ ...baseState, chapterCount: 3 });
    expect(statuses.narration).toBe("BLOCKED");
  });

  it("marks manuscript in progress while uploaded but unparsed", () => {
    const statuses = deriveStepStatuses({ ...baseState, sourceCount: 1 });
    expect(statuses.manuscript).toBe("IN_PROGRESS");
  });

  it("completes narration and review once every chapter has accepted audio", () => {
    const statuses = deriveStepStatuses({
      ...baseState,
      rightsAttested: true,
      sourceCount: 1,
      parsedSourceCount: 1,
      chapterCount: 2,
      chaptersWithAudio: 2,
    });
    expect(statuses.narration).toBe("DONE");
    expect(statuses.review).toBe("DONE");
  });

  it("treats a failed QC run as blocked", () => {
    expect(deriveStepStatuses({ ...baseState, qcResult: "FAILED" }).qc).toBe("BLOCKED");
  });
});

describe("narration gate", () => {
  it("requires chapters", () => {
    expect(canGenerateNarration({ rightsAttested: true, chapterCount: 0 }).allowed).toBe(false);
  });

  it("requires attested rights", () => {
    const gate = canGenerateNarration({ rightsAttested: false, chapterCount: 2 });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/rights/i);
  });

  it("allows generation once both hold", () => {
    expect(canGenerateNarration({ rightsAttested: true, chapterCount: 2 }).allowed).toBe(true);
  });
});

describe("export availability", () => {
  it("refuses export with no audio", () => {
    const d = evaluateExportAvailability({ audioAssetCount: 0, hasMockAudio: false });
    expect(d.allowed).toBe(false);
    expect(d.testOnly).toBe(false);
  });

  it("allows mock audio only as a clearly marked test package", () => {
    const d = evaluateExportAvailability({ audioAssetCount: 3, hasMockAudio: true });
    expect(d.allowed).toBe(true);
    expect(d.testOnly).toBe(true);
    expect(d.reason).toBe(MOCK_PACKAGE_WARNING);
    expect(d.reason).toMatch(/NOT distributable/);
  });

  it("does not mark real audio as test-only", () => {
    const d = evaluateExportAvailability({ audioAssetCount: 1, hasMockAudio: false });
    expect(d).toEqual({ allowed: true, testOnly: false, reason: null });
  });
});

describe("metadata suggestions require explicit apply", () => {
  const suggestion = {
    title: "Product title",
    subtitle: "Product subtitle",
    description: "Product description",
    language: "fr",
  };

  it("changes nothing when no field is selected", () => {
    expect(applyMetadataSuggestion(draft, suggestion, [])).toEqual(draft);
  });

  it("applies only the selected fields", () => {
    const next = applyMetadataSuggestion(draft, suggestion, ["subtitle"]);
    expect(next.subtitle).toBe("Product subtitle");
    expect(next.title).toBe("Existing title");
    expect(next.language).toBe("en");
  });

  it("never mutates the original draft", () => {
    applyMetadataSuggestion(draft, suggestion, ["title", "description"]);
    expect(draft.title).toBe("Existing title");
    expect(draft.description).toBe("");
  });

  it("ignores blank suggestion values", () => {
    const next = applyMetadataSuggestion(draft, { ...suggestion, subtitle: "   " }, ["subtitle"]);
    expect(next.subtitle).toBe("");
  });
});

describe("error redaction", () => {
  it("hides storage and infrastructure detail", () => {
    expect(safeErrorMessage(new Error("audiobook-audio/abc/def.wav not found"))).toBe(
      "Something went wrong.",
    );
    expect(safeErrorMessage(new Error("https://x.supabase.co/storage/v1/object failed"))).toBe(
      "Something went wrong.",
    );
  });

  it("keeps creator-facing messages", () => {
    expect(safeErrorMessage(new Error("Audiobook project not found"))).toBe(
      "Audiobook project not found",
    );
  });

  it("falls back for empty errors", () => {
    expect(safeErrorMessage(null)).toBe("Something went wrong.");
  });
});