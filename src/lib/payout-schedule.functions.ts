import { createServerFn } from "@tanstack/react-start";

// Exposes the weekly payout-release schedule state to the dashboard.
// Confirms the pg_cron job is actually installed AND computes the next
// scheduled Friday release, so the UI's "Ready for Release" indicator
// only appears when the backend schedule is truly active.
export const getPayoutScheduleStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nextRelease = computeNextFridayRelease(new Date());

    let scheduled = false;
    let cronExpr: string | null = null;
    try {
      const { data } = await supabaseAdmin
        .rpc("cron_job_exists" as never, { _name: "payout-release-heartbeat" } as never);
      if (typeof data === "boolean") scheduled = data;
      else if (data && typeof data === "object" && "exists" in (data as Record<string, unknown>)) {
        scheduled = Boolean((data as { exists: unknown }).exists);
      }
    } catch {
      // Fallback: consult the audit table for a recent successful run (within 8 days).
      const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const { data: runs } = await supabaseAdmin
        .from("payout_release_runs")
        .select("id")
        .eq("status", "completed")
        .gte("ran_at", cutoff)
        .limit(1);
      scheduled = !!(runs && runs.length > 0);
    }

    // Last successful run for display
    const { data: lastRun } = await supabaseAdmin
      .from("payout_release_runs")
      .select("ran_at,status,eligible_seller_count,eligible_pending_cents")
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      scheduled,
      cron: cronExpr ?? "0 14 * * 5",
      timezone: "UTC (Fri 14:00 UTC ≈ 10:00 AM Eastern)",
      next_release_at: nextRelease.toISOString(),
      last_run: lastRun ?? null,
    };
  },
);

function computeNextFridayRelease(from: Date): Date {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 14, 0, 0, 0),
  );
  const day = d.getUTCDay();
  let daysUntilFri = (5 - day + 7) % 7;
  if (daysUntilFri === 0 && from.getTime() >= d.getTime()) daysUntilFri = 7;
  d.setUTCDate(d.getUTCDate() + daysUntilFri);
  return d;
}
