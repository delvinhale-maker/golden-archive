/**
 * Pure cost-estimation + admin margin-signal helpers. Shotstack bills by
 * rendered output duration; this is a conservative estimate captured at
 * submission time (render_jobs.estimated_provider_cost_cents) for internal
 * margin tracking -- it is NEVER shown to customers (see
 * getMyEntitlementsFn, which exposes plan/quota language only, never cost).
 * Shotstack's render-status response does not return actual per-render
 * cost, so final_provider_cost_cents stays null unless/until an operator
 * reconciles it from Shotstack's billing export -- documented honestly
 * rather than inventing a fabricated "actual cost" the API doesn't supply.
 */

/** Rough placeholder rate (cents per rendered second) until a real Shotstack invoice is used to calibrate this -- deliberately conservative (high) so margin signals stay pessimistic rather than optimistic. */
const ESTIMATED_CENTS_PER_SECOND = 8;

export function estimateRenderCostCents(durationSeconds: number): number {
  return Math.round(durationSeconds * ESTIMATED_CENTS_PER_SECOND);
}

export type CreatorStudioCostSummary = {
  totalRenders: number;
  succeeded: number;
  failed: number;
  totalEstimatedCostCents: number;
  averageEstimatedCostCentsPerVideo: number;
  byPlan: Record<string, { renders: number; estimatedCostCents: number }>;
};

type RenderJobRow = {
  status: string;
  estimated_provider_cost_cents: number | null;
  owner_user_id: string;
};
type EntitlementPlanRow = { user_id: string; plan: string };

/** Pure aggregator -- takes already-fetched rows so it stays independently unit-testable without a DB connection. */
export function summarizeCreatorStudioCosts(
  renderJobs: RenderJobRow[],
  plansByUser: EntitlementPlanRow[],
): CreatorStudioCostSummary {
  const planByUserId = new Map(plansByUser.map((p) => [p.user_id, p.plan]));
  const byPlan: Record<string, { renders: number; estimatedCostCents: number }> = {};

  let totalEstimatedCostCents = 0;
  let succeeded = 0;
  let failed = 0;

  for (const job of renderJobs) {
    const cost = job.estimated_provider_cost_cents ?? 0;
    totalEstimatedCostCents += cost;
    if (job.status === "SUCCEEDED") succeeded++;
    if (job.status === "FAILED") failed++;

    const plan = planByUserId.get(job.owner_user_id) ?? "FREE";
    byPlan[plan] ??= { renders: 0, estimatedCostCents: 0 };
    byPlan[plan].renders += 1;
    byPlan[plan].estimatedCostCents += cost;
  }

  return {
    totalRenders: renderJobs.length,
    succeeded,
    failed,
    totalEstimatedCostCents,
    averageEstimatedCostCentsPerVideo:
      renderJobs.length > 0 ? Math.round(totalEstimatedCostCents / renderJobs.length) : 0,
    byPlan,
  };
}
