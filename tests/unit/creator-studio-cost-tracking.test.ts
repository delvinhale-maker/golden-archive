import { describe, it, expect } from "bun:test";
import {
  estimateRenderCostCents,
  summarizeCreatorStudioCosts,
} from "@/lib/creator-studio/cost-tracking";

describe("estimateRenderCostCents", () => {
  it("scales linearly with duration", () => {
    expect(estimateRenderCostCents(15)).toBeGreaterThan(0);
    expect(estimateRenderCostCents(30)).toBe(estimateRenderCostCents(15) * 2);
    expect(estimateRenderCostCents(45)).toBe(estimateRenderCostCents(15) * 3);
  });
});

describe("summarizeCreatorStudioCosts", () => {
  const jobs = [
    { status: "SUCCEEDED", estimated_provider_cost_cents: 100, owner_user_id: "u1" },
    { status: "SUCCEEDED", estimated_provider_cost_cents: 200, owner_user_id: "u2" },
    { status: "FAILED", estimated_provider_cost_cents: 50, owner_user_id: "u1" },
  ];
  const plans = [
    { user_id: "u1", plan: "CREATOR_PRO" },
    { user_id: "u2", plan: "CREATOR_BUSINESS" },
  ];

  it("counts totals, successes, and failures correctly", () => {
    const summary = summarizeCreatorStudioCosts(jobs, plans);
    expect(summary.totalRenders).toBe(3);
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.totalEstimatedCostCents).toBe(350);
    expect(summary.averageEstimatedCostCentsPerVideo).toBe(Math.round(350 / 3));
  });

  it("breaks cost down by plan, defaulting unknown users to FREE", () => {
    const summary = summarizeCreatorStudioCosts(jobs, plans);
    expect(summary.byPlan.CREATOR_PRO).toEqual({ renders: 2, estimatedCostCents: 150 });
    expect(summary.byPlan.CREATOR_BUSINESS).toEqual({ renders: 1, estimatedCostCents: 200 });
  });

  it("defaults to FREE plan for a user with no entitlements row", () => {
    const summary = summarizeCreatorStudioCosts(
      [{ status: "SUCCEEDED", estimated_provider_cost_cents: 80, owner_user_id: "unknown-user" }],
      [],
    );
    expect(summary.byPlan.FREE).toEqual({ renders: 1, estimatedCostCents: 80 });
  });

  it("returns a zeroed summary for an empty render job list", () => {
    const summary = summarizeCreatorStudioCosts([], []);
    expect(summary.totalRenders).toBe(0);
    expect(summary.averageEstimatedCostCentsPerVideo).toBe(0);
  });
});
