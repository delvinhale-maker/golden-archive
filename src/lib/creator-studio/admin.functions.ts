import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioEnabled } from "./feature-flags.middleware";
import { summarizeCreatorStudioCosts, type CreatorStudioCostSummary } from "./cost-tracking";

/**
 * Internal margin-signal aggregate: renders, successes, failures, total
 * estimated provider cost, average cost/video, cost broken out by plan. The
 * caller's admin role is verified explicitly (via the existing has_role
 * helper) rather than relying only on RLS's admin OR-clause, so a non-admin
 * gets a clear denial instead of a silently-empty aggregate. Never exposes
 * per-render provider cost to a non-admin caller -- this function itself is
 * the only place Creator Studio cost data leaves the database at all.
 */
export const getCreatorStudioCostSummaryFn = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudioCostSummary> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role" as any, {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Not authorized");

    const { data: renderJobs, error: jobsErr } = await context.supabase
      .from("creator_studio_render_jobs" as any)
      .select("status,estimated_provider_cost_cents,owner_user_id")
      .limit(10_000);
    if (jobsErr) throw new Error("Couldn't load render history");

    const { data: entitlements, error: entErr } = await context.supabase
      .from("creator_studio_entitlements" as any)
      .select("user_id,plan")
      .limit(10_000);
    if (entErr) throw new Error("Couldn't load plan data");

    return summarizeCreatorStudioCosts((renderJobs ?? []) as any, (entitlements ?? []) as any);
  });
