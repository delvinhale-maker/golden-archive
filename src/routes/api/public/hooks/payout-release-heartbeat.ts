import { createFileRoute } from "@tanstack/react-router";

// Weekly Friday payout release heartbeat.
//
// Called by pg_cron every Friday at 14:00 UTC (~10:00 AM Eastern).
// This does NOT auto-transfer money — payouts remain manual/off-Stripe.
// It logs a `payout_release_runs` row so:
//   1. The dashboard can trust "Ready for Release" is backed by a real,
//      confirmed weekly schedule.
//   2. Admins get an audit trail of which sellers were eligible each cycle.
//
// Authorization: publishable apikey header, same pattern as auto-release-reviews.
const HOLDING_HOURS = 24;

export const Route = createFileRoute("/api/public/hooks/payout-release-heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const triggeredBy = request.headers.get("x-triggered-by") ?? "cron";
        const cutoffIso = new Date(Date.now() - HOLDING_HOURS * 60 * 60 * 1000).toISOString();

        try {
          // Sellers with a positive pending balance
          const { data: bals, error: balErr } = await supabaseAdmin
            .from("seller_balances")
            .select("seller_id,pending_cents")
            .gt("pending_cents", 0);
          if (balErr) throw balErr;

          const balMap = new Map<string, number>();
          for (const b of bals ?? []) balMap.set(b.seller_id, Number(b.pending_cents));

          // Sellers with at least one paid order that has cleared the hold
          const { data: mature, error: matErr } = await supabaseAdmin
            .from("order_items")
            .select("seller_id,orders!inner(status,updated_at)")
            .eq("orders.status", "paid")
            .lt("orders.updated_at", cutoffIso);
          if (matErr) throw matErr;

          const eligibleSellers = new Set<string>();
          let eligibleCents = 0;
          for (const row of (mature ?? []) as Array<{ seller_id: string }>) {
            if (balMap.has(row.seller_id) && !eligibleSellers.has(row.seller_id)) {
              eligibleSellers.add(row.seller_id);
              eligibleCents += balMap.get(row.seller_id) ?? 0;
            }
          }

          const nextRelease = computeNextFridayRelease(new Date());

          await supabaseAdmin.from("payout_release_runs").insert({
            status: "completed",
            eligible_seller_count: eligibleSellers.size,
            eligible_pending_cents: eligibleCents,
            next_release_at: nextRelease.toISOString(),
            triggered_by: triggeredBy,
            notes:
              eligibleSellers.size === 0
                ? "No sellers had a cleared balance this cycle."
                : `Notified admins of ${eligibleSellers.size} seller(s) ready for release.`,
          });

          // Notify admins
          if (eligibleSellers.size > 0) {
            const { data: admins } = await supabaseAdmin
              .from("user_roles")
              .select("user_id")
              .eq("role", "admin");
            if (admins && admins.length) {
              await supabaseAdmin.from("notifications").insert(
                admins.map((a) => ({
                  user_id: a.user_id,
                  type: "payout_cycle_ready",
                  title: "Friday payout cycle ready",
                  body: `${eligibleSellers.size} seller(s) have cleared balances totalling $${(eligibleCents / 100).toFixed(2)}. Review and release in Admin → Payouts.`,
                  link: "/admin/payouts",
                })),
              );
            }
          }

          return Response.json({
            ok: true,
            eligible_sellers: eligibleSellers.size,
            eligible_cents: eligibleCents,
            next_release_at: nextRelease.toISOString(),
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          try {
            await supabaseAdmin.from("payout_release_runs").insert({
              status: "failed",
              triggered_by: triggeredBy,
              notes: msg.slice(0, 500),
            });
          } catch {
            /* ignore secondary log failure */
          }
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

// Next Friday at 14:00 UTC (~10:00 AM Eastern) after `from`.
function computeNextFridayRelease(from: Date): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 14, 0, 0, 0));
  const day = d.getUTCDay(); // 0=Sun..5=Fri
  let daysUntilFri = (5 - day + 7) % 7;
  if (daysUntilFri === 0 && from.getTime() >= d.getTime()) daysUntilFri = 7;
  d.setUTCDate(d.getUTCDate() + daysUntilFri);
  return d;
}
