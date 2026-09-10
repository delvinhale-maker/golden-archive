import { createMiddleware } from "@tanstack/react-start";

export const CREATOR_STUDIO_RENDERING_DISABLED_MESSAGE = "Creator Studio rendering is not available right now.";

export function isCreatorStudioRenderingEnabled(env: Record<string, string | undefined> = process.env) {
  return env.CREATOR_STUDIO_RENDERING_ENABLED === "true";
}

export const requireCreatorStudioRenderingEnabled = createMiddleware({ type: "function" }).server(async ({ next }) => {
  if (!isCreatorStudioRenderingEnabled(process.env)) throw new Error(CREATOR_STUDIO_RENDERING_DISABLED_MESSAGE);
  return next();
});
