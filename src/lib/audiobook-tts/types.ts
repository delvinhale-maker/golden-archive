/**
 * AurumVault Audiobook Studio — Phase 2 provider-neutral narration contract.
 *
 * No network code and no secret reads live in this directory in Phase 2. The
 * only registered runtime is the deterministic mock provider.
 */
import type { WavFormat } from "@/lib/audiobook-wav";

export type NarrationRequest = {
  text: string;
  voiceId?: string | null;
  model?: string | null;
  /** 0.25–4.0 in the providers we plan to support; mock accepts any value. */
  speed?: number;
  format?: WavFormat;
};

export type NarrationResult = {
  provider: string;
  model: string | null;
  /** Complete, valid WAV bytes. */
  wav: Uint8Array;
  characters: number;
  durationSeconds: number;
  sampleRate: number;
  /** True for placeholder audio that must never be treated as distributable. */
  isMock: boolean;
};

export type NarrationProvider = {
  readonly id: string;
  /** Placeholder/deterministic audio, not real speech. */
  readonly isMock: boolean;
  /** True when the provider performs paid external calls. */
  readonly requiresLiveFlag: boolean;
  synthesize(request: NarrationRequest): Promise<NarrationResult>;
};