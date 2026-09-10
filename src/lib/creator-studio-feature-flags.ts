export const CREATOR_STUDIO_DISABLED_MESSAGE = "Creator Studio is not available right now.";

export function isCreatorStudioEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.CREATOR_STUDIO_ENABLED === "true";
}
