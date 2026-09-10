import { createMiddleware } from "@tanstack/react-start";
import { CREATOR_STUDIO_DISABLED_MESSAGE, isCreatorStudioEnabled } from "@/lib/creator-studio-feature-flags";

export const requireCreatorStudioEnabled = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!isCreatorStudioEnabled(process.env)) throw new Error(CREATOR_STUDIO_DISABLED_MESSAGE);
    return next();
  },
);
