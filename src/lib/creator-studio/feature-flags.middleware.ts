import { createMiddleware } from "@tanstack/react-start";
import {
  isCreatorStudioEnabled,
  isCreatorStudioRenderingEnabled,
  isCreatorStudioPaidPlansEnabled,
  CREATOR_STUDIO_DISABLED_MESSAGE,
  CREATOR_STUDIO_RENDERING_DISABLED_MESSAGE,
  CREATOR_STUDIO_PAID_PLANS_DISABLED_MESSAGE,
} from "./feature-flags";

/**
 * Placed FIRST in every gated server function's middleware array (before
 * auth), so a disabled feature fails closed before any DB or auth work runs.
 */
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

export const requireCreatorStudioPaidPlansEnabled = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!isCreatorStudioPaidPlansEnabled(process.env)) {
      throw new Error(CREATOR_STUDIO_PAID_PLANS_DISABLED_MESSAGE);
    }
    return next();
  },
);
