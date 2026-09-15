/**
 * AurumVault Audiobook Studio — Phase 5 launch-gate tests.
 *
 * These assert the launch-blocking invariants only: fail-closed flags, gating
 * order, owner derivation, immutable source history, truthful readiness and
 * package markers, live-provider server-only isolation, the beta cost cap and
 * sanitized errors. No provider calls, no DB rows, no production data.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isAudiobookStudioEnabled,
  isAudiobookLiveTtsEnabled,
  isAudiobookStudioEnabledClient,
  getAudiobookTtsProvider,
} from "@/lib/audiobook-feature-flags";
import { checkLiveJobCharacterCap, MAX_LIVE_JOB_CHARACTERS } from "@/lib/audiobook-job-limits";
import { evaluateAudiobookReadiness } from "@/lib/audiobook-readiness";
import {
  buildPackageManifest,
  MOCK_NARRATION_MARKER,
  NOT_DISTRIBUTION_READY_MARKER,
} from "@/lib/audiobook-package";
import { evaluateRightsAttestation } from "@/lib/audiobook-rights";
import { isLiveOpenAiEligible, resolveNarrationProviderAsync } from "@/lib/audiobook-tts/registry";

const FUNCTION_FILES = [
  "src/lib/audiobook-projects.functions.ts",
  "src/lib/audiobook-jobs.functions.ts",
  "src/lib/audiobook-qc.functions.ts",
  "src/lib/audiobook-readiness.functions.ts",
  "src/lib/audiobook-package.functions.ts",
];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const completeMetadata = {
  title: "A Complete Title",
  authorName: "An Author",
  narratorName: "A Narrator",
  description: "x".repeat(200),
  language: "en",
  publisher: "AurumVault",
  isbn: "9781234567897",
  genre: "Business",
  keywords: ["business"],
  coverPath: "user/cover.jpg",
  copyrightYear: 2026,
};


const attestedRights = {
  status: "ATTESTED" as const,
  version: 1,
  statementText: "I own or control all rights required to produce this audiobook.",
  attestedAt: new Date().toISOString(),
  revokedAt: null,
};

describe("launch gate — flags fail closed", () => {
  it("everything is off with an empty environment", () => {
    expect(isAudiobookStudioEnabled({})).toBe(false);
    expect(isAudiobookLiveTtsEnabled({})).toBe(false);
    expect(isAudiobookStudioEnabledClient({})).toBe(false);
    expect(getAudiobookTtsProvider({})).toBe("mock");
  });

  it("live openai needs both flags, explicit provider and the secret", () => {
    const base = {
      AUDIOBOOK_STUDIO_ENABLED: "true",
      AUDIOBOOK_TTS_LIVE_ENABLED: "true",
      AUDIOBOOK_TTS_PROVIDER: "openai",
      OPENAI_API_KEY: "test-only-value",
    };
    expect(isLiveOpenAiEligible(base)).toBe(true);
    expect(isLiveOpenAiEligible({ ...base, AUDIOBOOK_TTS_LIVE_ENABLED: "false" })).toBe(false);
    expect(isLiveOpenAiEligible({ ...base, AUDIOBOOK_STUDIO_ENABLED: undefined })).toBe(false);
    expect(isLiveOpenAiEligible({ ...base, OPENAI_API_KEY: "" })).toBe(false);
    expect(isLiveOpenAiEligible({ ...base, AUDIOBOOK_TTS_PROVIDER: "elevenlabs" })).toBe(false);
  });

  it("falls back to the mock provider when live mode is not enabled", async () => {
    const provider = await resolveNarrationProviderAsync({});
    expect(provider.isMock).toBe(true);
    expect(provider.id).toBe("mock");
  });
});

describe("launch gate — server function hardening", () => {
  it("gates the feature flag before auth in every audiobook function module", () => {
    for (const file of FUNCTION_FILES) {
      const src = read(file);
      const chains = src.match(/\.middleware\(\[[^\]]*\]\)/g) ?? [];
      expect(chains.length).toBeGreaterThan(0);
      for (const chain of chains) {
        expect(chain).toContain("requireAudiobookStudioEnabled");
        expect(chain).toContain("requireSupabaseAuth");
        expect(chain.indexOf("requireAudiobookStudioEnabled")).toBeLessThan(
          chain.indexOf("requireSupabaseAuth"),
        );
      }
    }
  });

  it("never accepts an owner id from client input", () => {
    for (const file of FUNCTION_FILES) {
      const src = read(file);
      expect(src).not.toMatch(/ownerId:\s*(uuid|z\.string)/);
      expect(src).not.toMatch(/owner_id:\s*(uuid|z\.string)/);
      expect(src).not.toMatch(/owner_id:\s*data\./);
    }
  });

  it("never imports the service-role client at module scope", () => {
    for (const file of FUNCTION_FILES) {
      const src = read(file);
      expect(src).not.toMatch(/^import .*client\.server/m);
      expect(src).not.toContain("supabaseAdmin");
    }
  });

  it("keeps the live provider secret path server-only and out of client modules", () => {
    const adapter = read("src/lib/audiobook-tts/openai.server.ts");
    expect(adapter).toContain("OPENAI_PROVIDER_ID");
    const registry = read("src/lib/audiobook-tts/registry.ts");
    expect(registry).toMatch(/await import\("\.\/openai\.server"\)/);
    expect(registry).not.toMatch(/^import .*openai\.server/m);
    for (const file of [
      "src/routes/_authenticated/dashboard.audiobooks.index.tsx",
      "src/routes/_authenticated/dashboard.audiobooks.$audiobookId.tsx",
      "src/components/marketplace/PublisherShell.tsx",
    ]) {
      const src = read(file);
      expect(src).not.toContain("OPENAI_API_KEY");
      expect(src).not.toContain("openai.server");
    }
  });

  it("hides the creator UI behind the client flag by default", () => {
    const shell = read("src/components/marketplace/PublisherShell.tsx");
    expect(shell).toContain("isAudiobookStudioEnabledClient(import.meta.env)");
    const index = read("src/routes/_authenticated/dashboard.audiobooks.index.tsx");
    expect(index).toContain("isAudiobookStudioEnabledClient(import.meta.env)");
  });
});

describe("launch gate — immutable source history", () => {
  it("refuses a second parse instead of deleting existing chapters", () => {
    const src = read("src/lib/audiobook-projects.functions.ts");
    expect(src).toContain("Chapter text is immutable");
    expect(src).not.toMatch(/from\("audiobook_chapters"\)\s*\.delete\(\)/);
    expect(src).not.toMatch(/from\("audiobook_chapter_versions"\)\s*\.delete\(\)/);
  });
});

describe("launch gate — truthful readiness", () => {
  it("mock narration can never be production ready or distribution eligible", () => {
    const evaluation = evaluateAudiobookReadiness({
      metadata: completeMetadata,
      rights: attestedRights,
      chapterCount: 2,
      chaptersWithCurrentAudio: 2,
      hasMockAudio: true,
      qcOverallResult: "PASSED",
    });
    expect(evaluation.state).toBe("NOT_READY");
    expect(evaluation.blockers.map((b) => b.code)).toContain("READY_MOCK_NARRATION");
  });

  it("blocks on missing rights, QC and incomplete audio", () => {
    const evaluation = evaluateAudiobookReadiness({
      metadata: completeMetadata,
      rights: null,
      chapterCount: 3,
      chaptersWithCurrentAudio: 1,
      qcOverallResult: null,
    });
    const codes = evaluation.blockers.map((b) => b.code);
    expect(evaluation.state).toBe("NOT_READY");
    expect(codes).toContain("READY_AUDIO_INCOMPLETE");
    expect(codes).toContain("READY_QC_NOT_RUN");
    expect(evaluation.blockers.length).toBeGreaterThan(2);
  });

  it("never infers DISTRIBUTED without an explicit completed delivery", () => {
    const ready = {
      metadata: completeMetadata,
      rights: attestedRights,
      chapterCount: 1,
      chaptersWithCurrentAudio: 1,
      hasMockAudio: false,
      qcOverallResult: "PASSED" as const,
    };
    expect(evaluateAudiobookReadiness(ready).state).toBe("DISTRIBUTION_ELIGIBLE");
    expect(
      evaluateAudiobookReadiness({
        ...ready,
        deliveries: [{ distributor: "generic-retail", status: "IN_PROGRESS" }],
      }).state,
    ).toBe("DISTRIBUTION_ELIGIBLE");
    expect(
      evaluateAudiobookReadiness({
        ...ready,
        deliveries: [
          {
            distributor: "generic-retail",
            status: "COMPLETED",
            completedAt: new Date().toISOString(),
          },
        ],
      }).state,
    ).toBe("DISTRIBUTED");
  });

  it("makes no mastering or loudness claims", () => {
    const src = read("src/lib/audiobook-readiness.ts") + read("src/lib/audiobook-package.ts");
    expect(src).not.toMatch(/LUFS|mastered|broadcast[- ]ready/i);
  });
});

describe("launch gate — package truthfulness", () => {
  it("marks a mock package as not distribution ready", () => {
    const manifest = buildPackageManifest({
      projectId: "11111111-1111-4111-8111-111111111111",
      projectTitle: "Beta Project",
      generatedAt: "2026-01-01T00:00:00.000Z",
      metadata: completeMetadata,
      rights: evaluateRightsAttestation(attestedRights),
      readinessState: "NOT_READY",
      audio: [
        {
          order: 0,
          label: "Chapter One",
          bytes: new Uint8Array([1, 2, 3]),
          checksumSha256: "a".repeat(64),
          isMock: true,
          durationSeconds: 10,
        },
      ],
    });
    expect(manifest.contains_mock_narration).toBe(true);
    expect(manifest.distribution_ready).toBe(false);
    expect(manifest.markers).toContain(MOCK_NARRATION_MARKER);
    expect(manifest.markers).toContain(NOT_DISTRIBUTION_READY_MARKER);
  });

});

describe("launch gate — cost and abuse guards", () => {
  it("caps characters for a paid job but never for mock", () => {
    expect(checkLiveJobCharacterCap(1000, false).allowed).toBe(true);
    expect(checkLiveJobCharacterCap(MAX_LIVE_JOB_CHARACTERS + 1, false).allowed).toBe(false);
    expect(checkLiveJobCharacterCap(MAX_LIVE_JOB_CHARACTERS + 1, true).allowed).toBe(true);
    expect(checkLiveJobCharacterCap(0, false).allowed).toBe(false);
  });

  it("enforces the cap, rights and single ACTUAL usage row in the job path", () => {
    const src = read("src/lib/audiobook-jobs.functions.ts");
    expect(src).toContain("checkLiveJobCharacterCap");
    expect(src).toContain("requireRightsAttested");
    expect(src).toMatch(/\.eq\("kind", "ACTUAL"\)/);
    expect(src).toMatch(/status: "FAILED"/);
  });

  it("never logs narration text, keys or raw provider bytes", () => {
    const adapter = read("src/lib/audiobook-tts/openai.server.ts");
    expect(adapter).not.toMatch(/console\.(log|info|warn|error)/);
    expect(adapter).toContain("sanitizeProviderError");
  });
});