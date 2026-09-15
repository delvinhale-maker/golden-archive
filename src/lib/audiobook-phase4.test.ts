/**
 * AurumVault Audiobook Studio — Phase 4 targeted tests.
 *
 * All provider HTTP is MOCKED: no paid provider call happens in this suite.
 * The API key value is never printed or asserted on directly — only the
 * presence and shape of the Authorization header is checked.
 */
import { describe, it, expect } from "vitest";
import {
  resolveNarrationProvider,
  resolveNarrationProviderAsync,
  isLiveOpenAiEligible,
} from "./audiobook-tts/registry";
import { MOCK_PROVIDER_ID } from "./audiobook-tts/mock";
import {
  createOpenAiNarrationProvider,
  buildOpenAiSpeechBody,
  OPENAI_DEFAULT_MODEL,
  OPENAI_PCM_FORMAT,
  resolveOpenAiModel,
} from "./audiobook-tts/openai.server";
import { inspectWav } from "./audiobook-wav";
import { buildUsageRow, isApproximateEstimate } from "./audiobook-usage";
import { segmentText } from "./audiobook-segment";
import { narrationIdempotencyKey } from "./audiobook-idempotency";

const KEY = "test-only-not-a-real-key";

function pcmResponse(samples: number): Response {
  const pcm = new Int16Array(samples);
  for (let i = 0; i < samples; i++) pcm[i] = Math.round(Math.sin(i / 8) * 8000);
  return new Response(pcm.buffer, { status: 200 });
}

describe("registry fail-closed gating", () => {
  it("returns mock with no flags at all", () => {
    expect(resolveNarrationProvider({}).id).toBe(MOCK_PROVIDER_ID);
  });

  it("falls back to mock when the live flag is off", async () => {
    const env = { AUDIOBOOK_STUDIO_ENABLED: "true", AUDIOBOOK_TTS_PROVIDER: "openai" };
    expect(isLiveOpenAiEligible(env)).toBe(false);
    const provider = await resolveNarrationProviderAsync(env);
    expect(provider.id).toBe(MOCK_PROVIDER_ID);
    expect(provider.isMock).toBe(true);
  });


  it("refuses openai when the server key is absent", async () => {
    const env = {
      AUDIOBOOK_STUDIO_ENABLED: "true",
      AUDIOBOOK_TTS_LIVE_ENABLED: "true",
      AUDIOBOOK_TTS_PROVIDER: "openai",
    };
    expect(isLiveOpenAiEligible(env)).toBe(false);
    await expect(resolveNarrationProviderAsync(env)).rejects.toThrow();
  });

  it("is eligible only with both flags, explicit openai, and a key present", () => {
    expect(
      isLiveOpenAiEligible({
        AUDIOBOOK_STUDIO_ENABLED: "true",
        AUDIOBOOK_TTS_LIVE_ENABLED: "true",
        AUDIOBOOK_TTS_PROVIDER: "openai",
        OPENAI_API_KEY: KEY,
      }),
    ).toBe(true);
    expect(
      isLiveOpenAiEligible({
        AUDIOBOOK_STUDIO_ENABLED: "true",
        AUDIOBOOK_TTS_LIVE_ENABLED: "true",
        AUDIOBOOK_TTS_PROVIDER: "elevenlabs",
        OPENAI_API_KEY: KEY,
      }),
    ).toBe(false);
  });

  it("defaults the model and honours an explicit server model config", () => {
    expect(resolveOpenAiModel({})).toBe(OPENAI_DEFAULT_MODEL);
    expect(resolveOpenAiModel({ AUDIOBOOK_TTS_MODEL: "gpt-4o-tts" })).toBe("gpt-4o-tts");
  });
});

describe("openai adapter request shape (mocked fetch)", () => {
  it("posts PCM speech requests with an Authorization header present", async () => {
    let seen: { url: string; headers: Record<string, string>; body: any } | null = null;
    const provider = createOpenAiNarrationProvider({
      apiKey: KEY,
      fetchImpl: (async (url: any, init: any) => {
        seen = {
          url: String(url),
          headers: init.headers as Record<string, string>,
          body: JSON.parse(init.body as string),
        };
        return pcmResponse(24000);
      }) as unknown as typeof fetch,
    });

    const result = await provider.synthesize({ text: "AurumVault provider validation." });
    expect(seen).not.toBeNull();
    expect(seen!.url).toBe("https://api.openai.com/v1/audio/speech");
    // Presence only — the key value is never asserted or printed.
    expect(typeof seen!.headers.Authorization).toBe("string");
    expect(seen!.headers.Authorization.startsWith("Bearer ")).toBe(true);
    expect(seen!.body.response_format).toBe("pcm");
    expect(seen!.body.model).toBe(OPENAI_DEFAULT_MODEL);
    expect(result.isMock).toBe(false);
    expect(result.provider).toBe("openai");
  });

  it("builds a body carrying text, voice, and pcm format", () => {
    const body = buildOpenAiSpeechBody({ text: "hello", voiceId: "verse" }, OPENAI_DEFAULT_MODEL);
    expect(body.input).toBe("hello");
    expect(body.voice).toBe("verse");
    expect(body.response_format).toBe("pcm");
  });
});

describe("openai adapter PCM -> WAV correctness", () => {
  it("wraps provider PCM in a valid 24kHz mono 16-bit WAV", async () => {
    const provider = createOpenAiNarrationProvider({
      apiKey: KEY,
      fetchImpl: (async () => pcmResponse(48000)) as unknown as typeof fetch,
    });
    const result = await provider.synthesize({ text: "two seconds of audio" });
    const info = inspectWav(result.wav);
    expect(info.ok).toBe(true);
    expect(info.sampleRate).toBe(OPENAI_PCM_FORMAT.sampleRate);
    expect(info.channels).toBe(1);
    expect(info.bitsPerSample).toBe(16);
    expect(Math.round(info.durationSeconds)).toBe(2);
    expect(result.durationSeconds).toBeGreaterThan(1.9);
  });

  it("aggregates deterministic chunks into one valid WAV", async () => {
    const long = "Sentence number one. ".repeat(400);
    const segments = segmentText(long);
    expect(segments.length).toBeGreaterThan(1);
    const provider = createOpenAiNarrationProvider({
      apiKey: KEY,
      fetchImpl: (async () => pcmResponse(12000)) as unknown as typeof fetch,
    });
    const parts: Int16Array[] = [];
    for (const segment of segments) {
      const r = await provider.synthesize({ text: segment.text });
      const info = inspectWav(r.wav);
      const start = r.wav.byteLength - info.dataBytes;
      const copy = r.wav.slice(start, start + info.dataBytes);
      parts.push(new Int16Array(copy.buffer, copy.byteOffset, Math.floor(copy.byteLength / 2)));
    }
    const total = parts.reduce((n, p) => n + p.length, 0);
    const merged = new Int16Array(total);
    let cursor = 0;
    for (const p of parts) {
      merged.set(p, cursor);
      cursor += p.length;
    }
    const { pcmToWav } = await import("./audiobook-wav");
    const wav = pcmToWav(merged, OPENAI_PCM_FORMAT);
    const info = inspectWav(wav);
    expect(info.ok).toBe(true);
    expect(info.dataBytes).toBe(total * 2);
  });
});

describe("openai adapter sanitized errors", () => {
  it("reports status without leaking credentials or request internals", async () => {
    const provider = createOpenAiNarrationProvider({
      apiKey: KEY,
      fetchImpl: (async () =>
        new Response("invalid_api_key detail", { status: 401 })) as unknown as typeof fetch,
    });
    await expect(provider.synthesize({ text: "x" })).rejects.toThrow(/HTTP 401/);
    try {
      await provider.synthesize({ text: "x" });
    } catch (e) {
      expect(String((e as Error).message)).not.toContain(KEY);
      expect(String((e as Error).message)).not.toContain("Bearer");
    }
  });

  it("rejects an empty provider payload", async () => {
    const provider = createOpenAiNarrationProvider({
      apiKey: KEY,
      fetchImpl: (async () =>
        new Response(new ArrayBuffer(0), { status: 200 })) as unknown as typeof fetch,
    });
    await expect(provider.synthesize({ text: "x" })).rejects.toThrow(/no audio/i);
  });
});

describe("usage truthfulness and idempotency", () => {
  it("labels openai estimates approximate and never vendor-reported", () => {
    expect(isApproximateEstimate("openai")).toBe(true);
    expect(isApproximateEstimate("mock")).toBe(false);
    const row = buildUsageRow({
      ownerId: "o",
      projectId: "p",
      chapterId: "c",
      jobId: "j",
      kind: "ACTUAL",
      provider: "openai",
      model: OPENAI_DEFAULT_MODEL,
      characters: 1000,
      durationSeconds: 60,
    });
    expect(row.metadata.estimate_approximate).toBe(true);
    expect(row.metadata.vendor_reported_cost).toBe(false);
    expect(row.metadata.mock).toBe(false);
    const mockRow = buildUsageRow({
      ownerId: "o",
      projectId: "p",
      chapterId: "c",
      jobId: "j",
      kind: "ACTUAL",
      provider: "mock",
      model: null,
      characters: 5000,
    });
    expect(mockRow.cost_cents).toBe(0);
  });

  it("keeps idempotency keys deterministic and provider-scoped", async () => {
    const base = {
      projectId: "p",
      chapterId: "c",
      chapterVersionId: null,
      voiceConfigId: null,
      model: OPENAI_DEFAULT_MODEL,
      segmentationFingerprint: "fp",
      characters: 100,
    };
    const a = await narrationIdempotencyKey({ ...base, provider: "openai" });
    const b = await narrationIdempotencyKey({ ...base, provider: "openai" });
    const c = await narrationIdempotencyKey({ ...base, provider: "mock" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});