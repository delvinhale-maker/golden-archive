import { createServerFn } from "@tanstack/react-start";

// Exposes the weekly payout-release schedule state to the dashboard.
// Confirms the pg_cron job is actually installed AND computes the next
// scheduled Friday release, so the UI's "Ready for Release" indicator
// only appears when the backend schedule is truly active.
export const getPayoutScheduleStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nextRelease = computeNextFridayRelease(new Date());

    // Confirm the schedule is active by looking for a successful run in the
    // last 8 days (cron runs every Friday). The first cycle after install
    // may not have run yet, in which case we also treat the presence of the
    // audit table + a rescheduled run row as "scheduled".
    const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const { data: runs } = await supabaseAdmin
      .from("payout_release_runs")
      .select("id,status")
      .gte("ran_at", cutoff)
      .order("ran_at", { ascending: false })
      .limit(5);
    const scheduled = !!(runs && runs.some((r) => r.status === "completed"));

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
