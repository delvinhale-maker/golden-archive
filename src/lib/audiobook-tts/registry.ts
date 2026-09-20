/**
 * AurumVault Audiobook Studio — Phase 2 provider registry.
 *
 * FAIL-CLOSED: only the mock provider is registered. If configuration asks for
 * anything else while live TTS is disabled, resolution THROWS rather than
 * silently falling back to (or attempting) a paid provider.
 */
import {
  getAudiobookTtsProvider,
  isAudiobookLiveTtsEnabled,
  AUDIOBOOK_LIVE_TTS_DISABLED_MESSAGE,
  type AudiobookEnv,
} from "@/lib/audiobook-feature-flags";
import { mockNarrationProvider, MOCK_PROVIDER_ID } from "./mock";
import type { NarrationProvider } from "./types";

const PROVIDERS: Record<string, NarrationProvider> = {
  [MOCK_PROVIDER_ID]: mockNarrationProvider,
};

export function listNarrationProviders(): string[] {
  return Object.keys(PROVIDERS);
}

/**
 * Resolves the configured provider. Throws when live TTS is off and anything
 * other than mock is requested, and when a requested provider has no
 * registered (network-free) implementation.
 */
export function resolveNarrationProvider(env: AudiobookEnv): NarrationProvider {
  const configured = getAudiobookTtsProvider(env);
  if (!isAudiobookLiveTtsEnabled(env) && configured !== MOCK_PROVIDER_ID) {
    throw new Error(AUDIOBOOK_LIVE_TTS_DISABLED_MESSAGE);
  }
  const provider = PROVIDERS[configured];
  if (!provider) {
    throw new Error(
      `Narration provider "${configured}" is not available. ${AUDIOBOOK_LIVE_TTS_DISABLED_MESSAGE}`,
    );
  }
  if (provider.requiresLiveFlag && !isAudiobookLiveTtsEnabled(env)) {
    throw new Error(AUDIOBOOK_LIVE_TTS_DISABLED_MESSAGE);
  }
  return provider;
}

export const OPENAI_PROVIDER_ID = "openai";

/**
 * Phase 4 live-provider eligibility. Requires, in the CURRENT process:
 * master flag ON, live TTS flag ON, provider explicitly "openai", and the
 * server secret present. Any missing condition means mock/fail-closed.
 */
export function isLiveOpenAiEligible(env: AudiobookEnv): boolean {
  return (
    isAudiobookLiveTtsEnabled(env) &&
    getAudiobookTtsProvider(env) === OPENAI_PROVIDER_ID &&
    typeof env.OPENAI_API_KEY === "string" &&
    env.OPENAI_API_KEY.trim().length > 0
  );
}

/**
 * Async resolution used by server handlers. The live adapter is loaded through
 * a dynamic `.server.ts` import so no client bundle can reach the secret path.
 * Falls back to the strict synchronous mock-only resolution otherwise.
 */
export async function resolveNarrationProviderAsync(
  env: AudiobookEnv,
): Promise<NarrationProvider> {
  const configured = getAudiobookTtsProvider(env);
  if (configured === OPENAI_PROVIDER_ID) {
    if (!isLiveOpenAiEligible(env)) {
      throw new Error(AUDIOBOOK_LIVE_TTS_DISABLED_MESSAGE);
    }
    const { createOpenAiNarrationProvider, resolveOpenAiModel } = await import("./openai.server");
    return createOpenAiNarrationProvider({
      apiKey: env.OPENAI_API_KEY as string,
      model: resolveOpenAiModel(env),
    });
  }
  return resolveNarrationProvider(env);
}