/**
 * AurumVault Digital Rights Passport Generator — TanStack Start middleware
 * wrappers around the pure checks in rights-passport-feature-flags.ts.
 * Placed FIRST in every gated server function's `.middleware([...])` array
 * (before requireSupabaseAuth) so a disabled product/capability fails
 * before any auth or DB work happens, and a disabled user gets a clean,
 * generic message rather than an "Unauthorized" error that implies the
 * feature exists but they lack access to it.
 *
 * Server-side only — reads process.env directly, never the VITE_-prefixed
 * client mirror (see rights-passport-feature-flags.ts's SECURITY NOTE).
 */
import { createMiddleware } from "@tanstack/react-start";
import {
  isRightsPassportEnabled,
  isRightsPassportAiEnabled,
  isRightsPassportPublicPublishEnabled,
  RIGHTS_PASSPORT_DISABLED_MESSAGE,
  RIGHTS_PASSPORT_AI_DISABLED_MESSAGE,
  RIGHTS_PASSPORT_PUBLISH_DISABLED_MESSAGE,
} from "@/lib/rights-passport-feature-flags";

export const requireRightsPassportEnabled = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!isRightsPassportEnabled(process.env)) {
      throw new Error(RIGHTS_PASSPORT_DISABLED_MESSAGE);
    }
    return next();
  },
);

export const requireRightsPassportAiEnabled = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!isRightsPassportAiEnabled(process.env)) {
      throw new Error(RIGHTS_PASSPORT_AI_DISABLED_MESSAGE);
    }
    return next();
  },
);

export const requireRightsPassportPublicPublishEnabled = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  if (!isRightsPassportPublicPublishEnabled(process.env)) {
    throw new Error(RIGHTS_PASSPORT_PUBLISH_DISABLED_MESSAGE);
  }
  return next();
});
