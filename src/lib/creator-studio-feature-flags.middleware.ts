import { createMiddleware } from "@tanstack/react-start";

function isEnabled(name: string) {
  return process.env[name] === "true";
}

export const creatorStudioFlags = {
  core: () => isEnabled("CREATOR_STUDIO_ENABLED"),
  provider: () => isEnabled("CREATOR_STUDIO_PROVIDER_ENABLED"),
  productionProvider: () => isEnabled("CREATOR_STUDIO_SHOTSTACK_PRODUCTION_ENABLED"),
};

export const requireCreatorStudioEnabled = createMiddleware().server(async ({ next }) => {
  if (!creatorStudioFlags.core()) throw new Error("Creator Studio is temporarily unavailable");
  return next();
});

export const requireCreatorStudioProviderEnabled = createMiddleware().server(async ({ next }) => {
  if (!creatorStudioFlags.core() || !creatorStudioFlags.provider()) {
    throw new Error("Creator Studio rendering is temporarily unavailable");
  }
  return next();
});
