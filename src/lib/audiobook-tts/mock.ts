/**
 * AurumVault Audiobook Studio — Phase 2 deterministic mock narration provider.
 *
 * Produces genuinely valid 16-bit PCM WAV audio with NO network access, so the
 * whole pipeline (storage, QC, packaging, readiness) can be exercised without
 * a paid provider. Same text + settings always yields byte-identical output.
 *
 * The audio is intentionally an audible tone pattern, not speech — nothing
 * downstream may mistake it for a distributable master.
 */
import { pcmToWav, DEFAULT_WAV_FORMAT, type WavFormat } from "@/lib/audiobook-wav";
import type { NarrationProvider, NarrationRequest, NarrationResult } from "./types";

export const MOCK_PROVIDER_ID = "mock";

/** Deterministic 32-bit seed derived from the request. */
function seedFrom(request: NarrationRequest): number {
  const canonical = [
    request.text,
    request.voiceId ?? "-",
    request.model ?? "-",
    String(request.speed ?? 1),
  ].join("\u0000");
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h = (h ^ canonical.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** ~15 characters per second, matching audiobook-usage's estimate pace. */
export const MOCK_CHARS_PER_SECOND = 15;
const MIN_MOCK_SECONDS = 1.5;

export function mockDurationSeconds(characters: number): number {
  const raw = characters / MOCK_CHARS_PER_SECOND;
  return Math.max(MIN_MOCK_SECONDS, Math.round(raw * 100) / 100);
}

export function synthesizeMockWav(
  request: NarrationRequest,
  format: WavFormat = DEFAULT_WAV_FORMAT,
): { wav: Uint8Array; durationSeconds: number } {
  const characters = request.text.length;
  const durationSeconds = mockDurationSeconds(characters);
  const sampleCount = Math.max(1, Math.round(durationSeconds * format.sampleRate * format.channels));
  const pcm = new Int16Array(sampleCount);

  const seed = seedFrom(request);
  // Two stable tones chosen from the seed, so different text sounds different
  // while identical text is bit-identical.
  const baseHz = 180 + (seed % 120);
  const altHz = 240 + ((seed >>> 8) % 160);
  const amplitude = 9000; // well below full scale: never triggers clipping QC

  for (let i = 0; i < sampleCount; i++) {
    const t = i / format.sampleRate;
    const hz = Math.floor(t * 2) % 2 === 0 ? baseHz : altHz;
    // Short gaps keep the silent ratio realistic but under the dead-air limit.
    const gap = Math.floor(t * 4) % 8 === 7;
    pcm[i] = gap ? 0 : Math.round(Math.sin(2 * Math.PI * hz * t) * amplitude);
  }

  return { wav: pcmToWav(pcm, format), durationSeconds };
}

export const mockNarrationProvider: NarrationProvider = {
  id: MOCK_PROVIDER_ID,
  isMock: true,
  requiresLiveFlag: false,
  async synthesize(request: NarrationRequest): Promise<NarrationResult> {
    const format = request.format ?? DEFAULT_WAV_FORMAT;
    const { wav, durationSeconds } = synthesizeMockWav(request, format);
    return {
      provider: MOCK_PROVIDER_ID,
      model: request.model ?? null,
      wav,
      characters: request.text.length,
      durationSeconds,
      sampleRate: format.sampleRate,
      isMock: true,
    };
  },
};