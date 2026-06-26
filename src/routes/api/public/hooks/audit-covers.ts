import { createFileRoute } from "@tanstack/react-router";

// Cron entry point. Authenticated via the Supabase anon key in the `apikey` header
// (pg_cron + pg_net pattern). Runs the cover audit for every category and upserts
// the cached results into public.cover_audit_runs.
export const Route = createFileRoute("/api/public/hooks/audit-covers")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || !provided || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runCoverAudit, writeCoverAuditCache, COVER_AUDIT_CATEGORIES } = await import(
          "@/lib/cover-audit.server"
        );

        const summary: Record<string, { ok: boolean; total: number; failing: number; error?: string }> = {};
        for (const category of COVER_AUDIT_CATEGORIES) {
          try {
            const result = await runCoverAudit(supabaseAdmin, category);
            await writeCoverAuditCache(supabaseAdmin, result);
            summary[category] = { ok: result.ok, total: result.summary.total, failing: result.summary.failing };
          } catch (e) {
            summary[category] = { ok: false, total: 0, failing: 0, error: e instanceof Error ? e.message : String(e) };
          }
        }

        const allOk = Object.values(summary).every((s) => s.ok);
        return new Response(JSON.stringify({ ok: allOk, ranAt: new Date().toISOString(), summary }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
