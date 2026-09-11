/**
 * Cost-safety guardrails: nothing in this file is a paid-plan/entitlement
 * check (that's the RPC layer in the master migration) -- these are hard,
 * plan-independent ceilings that stop a single account from creating
 * unbounded provider spend or hammering Shotstack, regardless of how much
 * quota they otherwise have.
 */

export const MAX_SOURCE_ASSET_BYTES = 15 * 1024 * 1024;
export const MAX_SCREENSHOTS_PER_PROJECT = 10;
export const MAX_CONCURRENT_RENDERS_PER_USER = 2;
export const MAX_RENDER_SUBMISSIONS_PER_24H = 20;

const IN_FLIGHT_STATUSES = ["QUEUED", "SUBMITTED", "RENDERING"];

export type AbuseGuardrailResult = { allowed: true } | { allowed: false; safeMessage: string };

/** A minimal shape covering the one Supabase query builder method this module needs, so it isn't coupled to a specific client instance (RLS-bound or admin). */
type QueryableClient = {
  from(table: string): {
    select(
      columns: string,
      opts: { count: "exact"; head: true },
    ): {
      eq(col: string, val: unknown): any;
    };
  };
};

export async function checkCreatorStudioAbuseGuardrails(
  supabase: QueryableClient,
  userId: string,
): Promise<AbuseGuardrailResult> {
  const inFlight = await supabase
    .from("creator_studio_render_jobs")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", userId)
    .in("status", IN_FLIGHT_STATUSES);
  const inFlightCount = (inFlight as { count?: number | null }).count ?? 0;
  if (inFlightCount >= MAX_CONCURRENT_RENDERS_PER_USER) {
    return {
      allowed: false,
      safeMessage:
        "You already have a video being created. Wait for it to finish before starting another.",
    };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const daily = await supabase
    .from("creator_studio_render_jobs")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", userId)
    .gte("created_at", since);
  const dailyCount = (daily as { count?: number | null }).count ?? 0;
  if (dailyCount >= MAX_RENDER_SUBMISSIONS_PER_24H) {
    return {
      allowed: false,
      safeMessage: "You've reached today's video creation limit. Try again tomorrow.",
    };
  }

  return { allowed: true };
}
