/**
 * AurumVault Creator Studio™ — TanStack Start middleware wrappers around
 * the pure checks in creator-studio-feature-flags.ts. Placed FIRST in every
 * gated server function's `.middleware([...])` array (before
 * requireSupabaseAuth) so a disabled product/capability fails before any
 * auth or DB work happens, and a disabled user gets a clean, generic
 * message rather than an "Unauthorized" error that implies the feature
 * exists but they lack access to it. Mirrors
 * rights-passport-feature-flags.middleware.ts exactly.
 *
 * Server-side only — reads process.env directly, never the VITE_-prefixed
 * client mirror (see creator-studio-feature-flags.ts's SECURITY NOTE).
 */
import { createMiddleware } from "@tanstack/react-start";
import {
  isCreatorStudioEnabled,
  isCreatorStudioRenderingEnabled,
  isCreatorStudioBillingEnabled,
  CREATOR_STUDIO_DISABLED_MESSAGE,
  CREATOR_STUDIO_RENDERING_DISABLED_MESSAGE,
  CREATOR_STUDIO_BILLING_DISABLED_MESSAGE,
} from "@/lib/creator-studio-feature-flags";

export const requireCreatorStudioEnabled = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!isCreatorStudioEnabled(process.env)) {
      throw new Error(CREATOR_STUDIO_DISABLED_MESSAGE);
    }
    return next();
  },
);

export const requireCreatorStudioRenderingEnabled = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!isCreatorStudioRenderingEnabled(process.env)) {
      throw new Error(CREATOR_STUDIO_RENDERING_DISABLED_MESSAGE);
    }
    return next();
  },
);

export const requireCreatorStudioBillingEnabled = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!isCreatorStudioBillingEnabled(process.env)) {
      throw new Error(CREATOR_STUDIO_BILLING_DISABLED_MESSAGE);
    }
    return next();
  },
);
