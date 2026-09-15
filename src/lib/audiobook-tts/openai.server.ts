/**
 * AurumVault Audiobook Studio — Phase 4 live OpenAI narration adapter.
 *
 * SERVER ONLY. The `.server.ts` suffix keeps this module out of every client
 * bundle, so `OPENAI_API_KEY` can never reach the browser. It is reachable only
 * through a dynamic import inside a server handler (see registry.ts).
 *
 * SAFETY:
 * - Never logs narration text, the API key, the Authorization header, or raw
 *   response bytes. Errors are sanitized to status + short provider reason.
 * - Requests raw PCM and wraps it with the existing audiobook-wav helpers, so
 *   downstream concatenation, inspection, and QC keep working unchanged.
 * - Bounded response size and an explicit request timeout.
 */
import { pcmToWav, DEFAULT_WAV_FORMAT, inspectWav, type WavFormat } from "@/lib/audiobook-wav";
import type { NarrationProvider, NarrationRequest, NarrationResult } from "./types";

export const OPENAI_PROVIDER_ID = "openai";
export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini-tts";
export const OPENAI_DEFAULT_VOICE = "alloy";
const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";

/** OpenAI `response_format: "pcm"` is 24 kHz, mono, signed 16-bit LE. */
export const OPENAI_PCM_FORMAT: WavFormat = {
  sampleRate: 24000,
  channels: 1,
  bitsPerSample: 16,
};

const REQUEST_TIMEOUT_MS = 60_000;
/** ~30 minutes of 24 kHz mono 16-bit audio; a single segment is far smaller. */
const MAX_RESPONSE_BYTES = 90_000_000;
const MAX_TEXT_CHARACTERS = 4096;

export class OpenAiNarrationError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "OpenAiNarrationError";
    this.status = status;
  }
}

export function resolveOpenAiModel(env: Record<string, string | undefined>): string {
  const raw = (env.AUDIOBOOK_TTS_MODEL ?? "").trim();
  return raw.length > 0 ? raw : OPENAI_DEFAULT_MODEL;
}

export type OpenAiAdapterOptions = {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

/** Builds the exact HTTP request body sent to OpenAI. Exported for tests. */
export function buildOpenAiSpeechBody(
  request: NarrationRequest,
  model: string,
): Record<string, unknown> {
  return {
    model,
    input: request.text,
    voice: request.voiceId && request.voiceId.length > 0 ? request.voiceId : OPENAI_DEFAULT_VOICE,
    response_format: "pcm",
    ...(typeof request.speed === "number" ? { speed: request.speed } : {}),
  };
}

function sanitizeProviderError(status: number, snippet: string): string {
  // Only a short, key-free excerpt is surfaced.
  const cleaned = snippet.replace(/[\r\n]+/g, " ").slice(0, 160).trim();
  return `Narration provider request failed (HTTP ${status}).${cleaned ? ` ${cleaned}` : ""}`;
}

/**
 * Creates the live OpenAI provider. Callers must have already verified the
 * feature flags and secret presence (registry.ts does this).
 */
export function createOpenAiNarrationProvider(options: OpenAiAdapterOptions): NarrationProvider {
  const model = options.model && options.model.length > 0 ? options.model : OPENAI_DEFAULT_MODEL;
  const doFetch = options.fetchImpl ?? fetch;

  return {
    id: OPENAI_PROVIDER_ID,
    isMock: false,
    requiresLiveFlag: true,
    async synthesize(request: NarrationRequest): Promise<NarrationResult> {
      const text = request.text ?? "";
      if (text.trim().length === 0) {
        throw new OpenAiNarrationError("Narration text is empty.");
      }
      if (text.length > MAX_TEXT_CHARACTERS) {
        throw new OpenAiNarrationError(
          `Narration segment exceeds the provider limit of ${MAX_TEXT_CHARACTERS} characters.`,
        );
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await doFetch(OPENAI_SPEECH_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildOpenAiSpeechBody({ ...request, model }, model)),
          signal: controller.signal,
        });
      } catch {
        // No provider response was produced; message carries no request detail.
        throw new OpenAiNarrationError("Narration provider was unreachable or timed out.");
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        let snippet = "";
        try {
          snippet = (await response.text()).slice(0, 400);
        } catch {
          snippet = "";
        }
        throw new OpenAiNarrationError(
          sanitizeProviderError(response.status, snippet),
          response.status,
        );
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength === 0) {
        throw new OpenAiNarrationError("Narration provider returned no audio.");
      }
      if (buffer.byteLength > MAX_RESPONSE_BYTES) {
        throw new OpenAiNarrationError("Narration provider returned an unexpectedly large payload.");
      }

      const format = request.format ?? OPENAI_PCM_FORMAT;
      const usableBytes = buffer.byteLength - (buffer.byteLength % 2);
      const pcm = new Int16Array(buffer.slice(0, usableBytes));
      const wav = pcmToWav(pcm, format);
      const info = inspectWav(wav);
      if (!info.ok) {
        throw new OpenAiNarrationError("Narration provider audio could not be validated.");
      }

      return {
        provider: OPENAI_PROVIDER_ID,
        model,
        wav,
        characters: text.length,
        durationSeconds: Math.round(info.durationSeconds * 100) / 100,
        sampleRate: info.sampleRate,
        isMock: false,
      };
    },
  };
}

export { DEFAULT_WAV_FORMAT };