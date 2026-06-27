import { createFileRoute } from "@tanstack/react-router";

// Auto-releases products stuck in "pending" review for ≥ 24 hours.
// Called hourly by pg_cron. Authenticated via the project's publishable
// apikey header (same key the cron job sends).
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

        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Find pending products older than 24h
        const { data: stale, error: findErr } = await supabaseAdmin
          .from("marketplace_products")
          .select("id,title,seller_id,created_at")
          .eq("status", "pending")
          .lt("created_at", cutoff);

        if (findErr) {
          return new Response(JSON.stringify({ error: findErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!stale || stale.length === 0) {
          return Response.json({ released: 0, ids: [] });
        }

        const ids = stale.map((p) => p.id);
        const nowIso = new Date().toISOString();

        const { error: updErr } = await supabaseAdmin
          .from("marketplace_products")
          .update({
            status: "approved",
            published: true,
            approved_at: nowIso,
          })
          .in("id", ids);

        if (updErr) {
          return new Response(JSON.stringify({ error: updErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Best-effort notifications to sellers
        try {
          await supabaseAdmin.from("notifications").insert(
            stale.map((p) => ({
              user_id: p.seller_id,
              title: "Your product is live",
              body: `"${p.title}" was auto-released after the 24-hour review window.`,
              type: "product_auto_released",
            })),
          );
        } catch {
          // notifications table may have different shape; ignore
        }

        console.log(`[auto-release] released ${ids.length} products`, ids);

        return Response.json({ released: ids.length, ids });
      },
    },
  },
});
