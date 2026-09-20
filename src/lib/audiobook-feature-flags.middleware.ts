/**
 * AurumVault Audiobook Studio — TanStack Start middleware wrappers around the
 * pure checks in audiobook-feature-flags.ts. Placed FIRST in a gated server
 * function's `.middleware([...])` array (before requireSupabaseAuth) so a
 * disabled product fails before any auth or DB work happens.
 *
 * Server-side only — reads process.env directly, never the VITE_-prefixed
 * client mirror.
 */
import { createMiddleware } from "@tanstack/react-start";
import {
  isAudiobookStudioEnabled,
  isAudiobookLiveTtsEnabled,
  AUDIOBOOK_STUDIO_DISABLED_MESSAGE,
  AUDIOBOOK_LIVE_TTS_DISABLED_MESSAGE,
} from "@/lib/audiobook-feature-flags";

export const requireAudiobookStudioEnabled = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!isAudiobookStudioEnabled(process.env)) {
      throw new Error(AUDIOBOOK_STUDIO_DISABLED_MESSAGE);
    }
    return next();
  },
);

export const requireAudiobookLiveTtsEnabled = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!isAudiobookLiveTtsEnabled(process.env)) {
      throw new Error(AUDIOBOOK_LIVE_TTS_DISABLED_MESSAGE);
    }
    return next();
  },
);