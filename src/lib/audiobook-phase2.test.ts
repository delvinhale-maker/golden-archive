/**
 * AurumVault Audiobook Studio — Phase 2 focused test suite.
 *
 * Mock provider only; no network, no secrets, no production rows.
 */
import { describe, it, expect } from "vitest";
import { parseChaptersFromText, audiobookSourceKind } from "@/lib/audiobook-parser";
import { segmentText, totalCharacters, segmentationFingerprint } from "@/lib/audiobook-segment";
import {
  isAudiobookStudioEnabled,
  isAudiobookLiveTtsEnabled,
  getAudiobookTtsProvider,
} from "@/lib/audiobook-feature-flags";
import { narrationIdempotencyKey } from "@/lib/audiobook-idempotency";
import { mockNarrationProvider, synthesizeMockWav } from "@/lib/audiobook-tts/mock";
import { resolveNarrationProvider } from "@/lib/audiobook-tts/registry";
import { inspectWav, pcmToWav } from "@/lib/audiobook-wav";
import { evaluateAudiobookQc } from "@/lib/audiobook-qc";
import { evaluateAudiobookMetadata } from "@/lib/audiobook-metadata";
import { evaluateRightsAttestation } from "@/lib/audiobook-rights";
import { evaluateAudiobookReadiness } from "@/lib/audiobook-readiness";
import { buildUsageRow } from "@/lib/audiobook-usage";
import {
  buildPackageManifest,
  sanitizeAudioFileName,
  MOCK_NARRATION_MARKER,
  NOT_DISTRIBUTION_READY_MARKER,
} from "@/lib/audiobook-package";
import { assertOwnedAudiobookPath } from "@/lib/audiobook-storage.server";

const COMPLETE_METADATA = {
  title: "The Long Road",
  authorName: "A. Writer",
  narratorName: "Synthetic Narrator (AI)",
  language: "en",
  description:
    "A complete description of the audiobook that comfortably exceeds the minimum length required for distribution metadata checks.",
  coverPath: "user/cover.png",
  publisher: "AurumVault Press",
  genre: "Fiction",
  keywords: ["road", "journey"],
  copyrightYear: 2026,
  isbn: "9781234567897",
};

const ATTESTED = {
  status: "ATTESTED" as const,
  version: 1,
  statementText: "I hold full audio and narration rights to this work.",
  attestedAt: "2026-09-01T00:00:00.000Z",
};

describe("parser", () => {
  it("splits TXT chapters and preserves the source text", () => {
    const text = "Front matter.\n\nChapter 1\nOnce upon a time.\n\nChapter 2\nAnd then.\n";
    const result = parseChaptersFromText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chapters.length).toBeGreaterThanOrEqual(3);
    expect(result.chapters.map((c) => c.text).join("")).toBe(text);
  });

  it("rejects empty input and unknown extensions truthfully", () => {
    expect(parseChaptersFromText("   \n  ").ok).toBe(false);
    expect(audiobookSourceKind("book.exe")).toBe("unknown");
    expect(audiobookSourceKind("book.DOCX")).toBe("docx");
  });
});

describe("segmentation", () => {
  const long = ("Sentence number one is here. ".repeat(600)).trim();

  it("is deterministic and character-preserving", () => {
    const a = segmentText(long);
    const b = segmentText(long);
    expect(segmentationFingerprint(a)).toBe(segmentationFingerprint(b));
    expect(a.map((s) => s.text).join("")).toBe(long);
    expect(totalCharacters(a)).toBe(long.length);
    expect(a.length).toBeGreaterThan(1);
  });

  it("never exceeds the configured maximum", () => {
    for (const s of segmentText(long, { maxChars: 1000 })) {
      expect(s.charCount).toBeLessThanOrEqual(1000);
    }
  });
});

describe("feature flags", () => {
  it("is fail-closed by default", () => {
    expect(isAudiobookStudioEnabled({})).toBe(false);
    expect(isAudiobookLiveTtsEnabled({})).toBe(false);
    expect(getAudiobookTtsProvider({})).toBe("mock");
    expect(
      getAudiobookTtsProvider({ AUDIOBOOK_TTS_PROVIDER: "openai" }),
    ).toBe("mock");
  });

  it("resolves only the mock provider while live TTS is off", () => {
    expect(resolveNarrationProvider({}).id).toBe("mock");
    expect(() =>
      resolveNarrationProvider({
        AUDIOBOOK_STUDIO_ENABLED: "true",
        AUDIOBOOK_TTS_LIVE_ENABLED: "true",
        AUDIOBOOK_TTS_PROVIDER: "openai",
      }),
    ).toThrow();
  });
});

describe("idempotency", () => {
  const base = {
    projectId: "11111111-1111-1111-1111-111111111111",
    chapterId: "22222222-2222-2222-2222-222222222222",
    chapterVersionId: null,
    voiceConfigId: null,
    provider: "mock",
    model: null,
    segmentationFingerprint: "0:0-100",
    characters: 100,
  };

  it("is stable for identical requests", async () => {
    expect(await narrationIdempotencyKey(base)).toBe(await narrationIdempotencyKey(base));
  });

  it("changes when narration text or settings change", async () => {
    const original = await narrationIdempotencyKey(base);
    expect(await narrationIdempotencyKey({ ...base, segmentationFingerprint: "0:0-120" })).not.toBe(
      original,
    );
    expect(
      await narrationIdempotencyKey({
        ...base,
        voiceConfigId: "33333333-3333-3333-3333-333333333333",
      }),
    ).not.toBe(original);
  });
});

describe("mock narration audio", () => {
  it("produces deterministic, valid, non-clipping WAV", async () => {
    const first = synthesizeMockWav({ text: "Hello narration world." });
    const second = synthesizeMockWav({ text: "Hello narration world." });
    expect(Array.from(first.wav.slice(0, 200))).toEqual(Array.from(second.wav.slice(0, 200)));
    expect(first.wav.byteLength).toBe(second.wav.byteLength);

    const info = inspectWav(first.wav);
    expect(info.ok).toBe(true);
    expect(info.bitsPerSample).toBe(16);
    expect(info.truncated).toBe(false);
    expect(info.durationSeconds).toBeGreaterThan(0);
    expect(info.clippedRatio).toBeLessThanOrEqual(0.005);

    const result = await mockNarrationProvider.synthesize({ text: "Hi" });
    expect(result.isMock).toBe(true);
    expect(result.provider).toBe("mock");
  });

  it("detects clipping, silence and truncation", () => {
    const clipped = pcmToWav(new Int16Array(2400).fill(32767));
    expect(inspectWav(clipped).clippedRatio).toBeGreaterThan(0.005);

    const silent = pcmToWav(new Int16Array(2400));
    expect(inspectWav(silent).silentRatio).toBe(1);

    const good = synthesizeMockWav({ text: "x".repeat(300) }).wav;
    const cut = good.slice(0, good.byteLength - 1000);
    const info = inspectWav(cut);
    expect(info.truncated).toBe(true);
    expect(info.ok).toBe(false);
  });
});

describe("blockers", () => {
  it("flags missing metadata", () => {
    const evaluation = evaluateAudiobookMetadata({ title: "Only a title" });
    expect(evaluation.isComplete).toBe(false);
    expect(evaluation.blockers.map((b) => b.code)).toContain("META_AUTHOR_MISSING");
  });

  it("blocks missing and revoked rights", () => {
    expect(evaluateRightsAttestation(null).blocked).toBe(true);
    expect(evaluateRightsAttestation({ status: "REVOKED" }).blocked).toBe(true);
    expect(evaluateRightsAttestation(ATTESTED).blocked).toBe(false);
  });

  it("fails QC when mock narration is present", () => {
    const info = inspectWav(synthesizeMockWav({ text: "x".repeat(300) }).wav);
    const qc = evaluateAudiobookQc({
      metadata: COMPLETE_METADATA,
      rights: ATTESTED,
      audio: [{ label: "Chapter 1", info, isMock: true }],
      chapterCount: 1,
      chaptersWithAudio: 1,
    });
    expect(qc.overallResult).toBe("FAILED");
    expect(qc.checks.some((c) => c.check_code === "AUDIO_MOCK_NARRATION")).toBe(true);
  });
});

describe("readiness truthfulness", () => {
  const readyBase = {
    metadata: COMPLETE_METADATA,
    rights: ATTESTED,
    chapterCount: 2,
    chaptersWithCurrentAudio: 2,
    qcOverallResult: "PASSED" as const,
  };

  it("never marks mock narration production-ready or distributable", () => {
    const evaluation = evaluateAudiobookReadiness({ ...readyBase, hasMockAudio: true });
    expect(evaluation.state).toBe("NOT_READY");
    expect(evaluation.blockers.map((b) => b.code)).toContain("READY_MOCK_NARRATION");
  });

  it("never infers DISTRIBUTED without a completed delivery", () => {
    const eligible = evaluateAudiobookReadiness({ ...readyBase, hasMockAudio: false });
    expect(eligible.state).toBe("DISTRIBUTION_ELIGIBLE");

    const inProgress = evaluateAudiobookReadiness({
      ...readyBase,
      hasMockAudio: false,
      deliveries: [{ distributor: "generic-retail", status: "IN_PROGRESS" }],
    });
    expect(inProgress.state).toBe("DISTRIBUTION_ELIGIBLE");

    const distributed = evaluateAudiobookReadiness({
      ...readyBase,
      hasMockAudio: false,
      deliveries: [
        {
          distributor: "generic-retail",
          status: "COMPLETED",
          completedAt: "2026-09-02T00:00:00.000Z",
        },
      ],
    });
    expect(distributed.state).toBe("DISTRIBUTED");
  });

  it("blocks on incomplete coverage, failed QC and missing QC", () => {
    expect(
      evaluateAudiobookReadiness({ ...readyBase, hasMockAudio: false, chaptersWithCurrentAudio: 1 })
        .state,
    ).toBe("NOT_READY");
    expect(
      evaluateAudiobookReadiness({ ...readyBase, hasMockAudio: false, qcOverallResult: "FAILED" })
        .state,
    ).toBe("NOT_READY");
    expect(
      evaluateAudiobookReadiness({ ...readyBase, hasMockAudio: false, qcOverallResult: null }).state,
    ).toBe("NOT_READY");
  });

  it("keeps distributor compatibility separate from readiness", () => {
    const evaluation = evaluateAudiobookReadiness({
      ...readyBase,
      hasMockAudio: false,
      metadata: { ...COMPLETE_METADATA, isbn: null },
    });
    expect(evaluation.state).toBe("PRODUCTION_READY");
    expect(evaluation.distributorCompatibility[0]?.compatible).toBe(false);
  });
});

describe("usage", () => {
  it("charges nothing for mock narration and shapes ESTIMATE/ACTUAL rows", () => {
    const estimate = buildUsageRow({
      ownerId: "u",
      projectId: "p",
      chapterId: "c",
      jobId: "j",
      kind: "ESTIMATE",
      provider: "mock",
      model: null,
      characters: 15000,
    });
    expect(estimate.cost_cents).toBe(0);
    expect(estimate.kind).toBe("ESTIMATE");
    expect(estimate.duration_seconds).toBeGreaterThan(0);
    expect(estimate.metadata).toMatchObject({ mock: true, billable: false });

    const actual = buildUsageRow({
      ownerId: "u",
      projectId: "p",
      chapterId: "c",
      jobId: "j",
      kind: "ACTUAL",
      provider: "mock",
      model: null,
      characters: 15000,
      durationSeconds: 12.5,
    });
    expect(actual.kind).toBe("ACTUAL");
    expect(actual.cost_cents).toBe(0);
    expect(actual.duration_seconds).toBe(12.5);
  });
});

describe("package", () => {
  const audio = [
    {
      order: 1,
      label: "Chapter 2: The Return",
      bytes: new Uint8Array([1, 2, 3]),
      checksumSha256: "b".repeat(64),
      isMock: true,
      durationSeconds: 3,
    },
    {
      order: 0,
      label: "Chapter 1 / Departure",
      bytes: new Uint8Array([4, 5]),
      checksumSha256: "a".repeat(64),
      isMock: true,
      durationSeconds: 2,
    },
  ];

  it("orders files deterministically with sanitized names and checksums", () => {
    const manifest = buildPackageManifest({
      projectId: "p",
      projectTitle: "The Long Road",
      metadata: COMPLETE_METADATA,
      rights: evaluateRightsAttestation(ATTESTED),
      readinessState: "NOT_READY",
      audio,
      generatedAt: "2026-09-02T00:00:00.000Z",
    });
    expect(manifest.files.map((f) => f.path)).toEqual([
      "audio/001-chapter-1-departure.wav",
      "audio/002-chapter-2-the-return.wav",
    ]);
    expect(manifest.files[0]?.checksumSha256).toBe("a".repeat(64));
    expect(sanitizeAudioFileName("  ***  ", 0)).toBe("audio/001-chapter.wav");
  });

  it("marks mock packages as not distribution ready", () => {
    const manifest = buildPackageManifest({
      projectId: "p",
      projectTitle: "The Long Road",
      metadata: COMPLETE_METADATA,
      rights: evaluateRightsAttestation(ATTESTED),
      readinessState: "NOT_READY",
      audio,
      generatedAt: "2026-09-02T00:00:00.000Z",
    });
    expect(manifest.markers).toContain(MOCK_NARRATION_MARKER);
    expect(manifest.markers).toContain(NOT_DISTRIBUTION_READY_MARKER);
    expect(manifest.distribution_ready).toBe(false);
    expect(manifest.contains_mock_narration).toBe(true);
  });
});

describe("storage path guards", () => {
  it("rejects foreign, traversing and non-audiobook paths", () => {
    expect(() =>
      assertOwnedAudiobookPath("audiobook-audio", "user-a/project/file.wav", "user-a"),
    ).not.toThrow();
    expect(() =>
      assertOwnedAudiobookPath("audiobook-audio", "user-b/project/file.wav", "user-a"),
    ).toThrow();
    expect(() =>
      assertOwnedAudiobookPath("audiobook-audio", "user-a/../user-b/f.wav", "user-a"),
    ).toThrow();
    expect(() => assertOwnedAudiobookPath("product-files", "user-a/f.wav", "user-a")).toThrow();
  });
});