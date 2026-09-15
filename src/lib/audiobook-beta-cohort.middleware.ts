/**
 * AurumVault Audiobook Studio — controlled beta cohort gate.
 *
 * Runs AFTER requireSupabaseAuth (so context.userId/supabase exist) and BEFORE
 * any handler work. The cohort is defined by the store's existing role
 * primitive: public.has_role(user_id, 'admin'). Optionally an explicit,
 * server-only comma-separated user-id allowlist (AUDIOBOOK_BETA_USER_IDS) may
 * widen the cohort without a schema change.
 *
 * FAIL-CLOSED: any error, missing role, or non-listed user is denied with a
 * generic message that does not reveal the feature's existence.
 */
import { createMiddleware } from "@tanstack/react-start";

export const AUDIOBOOK_BETA_DENIED_MESSAGE =
  "Audiobook Studio is not currently available.";

export function parseBetaAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function isInBetaAllowlist(userId: string, raw: string | undefined): boolean {
  return parseBetaAllowlist(raw).includes(userId);
}

export const requireAudiobookBetaCohort = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const { supabase, userId } = context as unknown as {
      supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
      userId: string;
    };

    if (isInBetaAllowlist(userId, process.env.AUDIOBOOK_BETA_USER_IDS)) {
      return next();
    }

    let isAdmin = false;
    try {
      const { data } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      isAdmin = data === true;
    } catch {
      isAdmin = false;
    }

    if (!isAdmin) {
      throw new Error(AUDIOBOOK_BETA_DENIED_MESSAGE);
    }
    return next();
  },
);