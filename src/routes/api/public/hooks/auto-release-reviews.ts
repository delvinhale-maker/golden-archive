import { createFileRoute } from "@tanstack/react-router";

// Auto-releases products stuck in "pending" review for ≥ 24 hours.
// Called hourly by pg_cron. Authenticated via the project's publishable
// apikey header (same key the cron job sends). Every invocation logs a
// row to `auto_release_runs` so admins can audit success/failure.
export const Route = createFileRoute("/api/public/hooks/auto-release-reviews")({
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
        const startedAt = Date.now();
        const triggeredBy = request.headers.get("x-triggered-by") ?? "cron";

        const logRun = async (row: {
          status: "success" | "failure" | "no_op";
          released_count?: number;
          released_ids?: string[];
          candidate_count?: number;
          error_message?: string | null;
        }) => {
          try {
            await supabaseAdmin.from("auto_release_runs").insert({
              status: row.status,
              released_count: row.released_count ?? 0,
              released_ids: row.released_ids ?? [],
              candidate_count: row.candidate_count ?? 0,
              error_message: row.error_message ?? null,
              duration_ms: Date.now() - startedAt,
              triggered_by: triggeredBy,
            });
          } catch (e) {
            console.error("[auto-release] failed to log run", e);
          }
        };

        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: stale, error: findErr } = await supabaseAdmin
          .from("marketplace_products")
          .select("id,title,seller_id,created_at")
          .eq("status", "pending")
          .lt("created_at", cutoff);

        if (findErr) {
          await logRun({ status: "failure", error_message: `find: ${findErr.message}` });
          return new Response(JSON.stringify({ error: findErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!stale || stale.length === 0) {
          await logRun({ status: "no_op", candidate_count: 0 });
          return Response.json({ released: 0, ids: [] });
        }

        const candidateIds = stale.map((p) => p.id);
        const nowIso = new Date().toISOString();

        // Idempotent update: only flip rows still pending. Concurrent runs
        // can't double-approve, and `.select()` returns only rows this call
        // actually changed.
        const { data: released, error: updErr } = await supabaseAdmin
          .from("marketplace_products")
          .update({
            status: "approved",
            published: true,
            approved_at: nowIso,
          })
          .in("id", candidateIds)
          .eq("status", "pending")
          .select("id,title,seller_id");

        if (updErr) {
          await logRun({
            status: "failure",
            candidate_count: candidateIds.length,
            error_message: `update: ${updErr.message}`,
          });
          return new Response(JSON.stringify({ error: updErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const releasedRows = released ?? [];
        const releasedIds = releasedRows.map((r) => r.id);

        if (releasedRows.length === 0) {
          await logRun({
            status: "no_op",
            candidate_count: candidateIds.length,
            error_message: "rows already processed by a concurrent run",
          });
          return Response.json({ released: 0, ids: [] });
        }

        try {
          await supabaseAdmin.from("notifications").insert(
            releasedRows.map((p) => ({
              user_id: p.seller_id,
              title: "Your product is live",
              body: `"${p.title}" was auto-released after the 24-hour review window.`,
              type: "product_auto_released",
            })),
          );
        } catch {
          // notifications table may have different shape; ignore
        }

        await logRun({
          status: "success",
          candidate_count: candidateIds.length,
          released_count: releasedIds.length,
          released_ids: releasedIds,
        });

        console.log(`[auto-release] released ${releasedIds.length} products`, releasedIds);

        return Response.json({ released: releasedIds.length, ids: releasedIds });
      },
    },
  },
});
