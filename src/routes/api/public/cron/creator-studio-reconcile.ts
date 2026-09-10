import { createFileRoute } from "@tanstack/react-router";
import { reconcileCreatorStudioRenderJobInternal } from "@/lib/creator-studio.render-jobs.server";

const MAX_JOBS_PER_SWEEP = 5;

export const Route = createFileRoute("/api/public/cron/creator-studio-reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const configured = process.env.CREATOR_STUDIO_RECONCILE_SECRET;
        const presented = request.headers.get("x-creator-studio-reconcile-secret");
        if (!configured || !presented || presented !== configured) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;
        const expired = await admin.rpc("creator_studio_server_expire_stuck_renders", {
          _limit: 25,
        });
        if (expired.error) {
          console.error("[creator-studio] watchdog timeout sweep failed", {
            message: expired.error.message,
          });
        }

        const { data: jobs, error } = await admin
          .from("creator_studio_render_jobs")
          .select("id")
          .in("status", ["SUBMITTED", "RENDERING"])
          .not("provider_job_id", "is", null)
          .order("updated_at", { ascending: true })
          .limit(MAX_JOBS_PER_SWEEP);
        if (error) {
          console.error("[creator-studio] watchdog job lookup failed", { message: error.message });
          return Response.json({ ok: false }, { status: 500 });
        }

        let reconciled = 0;
        let deferred = 0;
        for (const job of jobs ?? []) {
          try {
            await reconcileCreatorStudioRenderJobInternal(String(job.id));
            reconciled += 1;
          } catch (reconcileError) {
            deferred += 1;
            console.error("[creator-studio] watchdog reconciliation deferred", {
              renderJobId: job.id,
              error:
                reconcileError instanceof Error
                  ? reconcileError.message
                  : String(reconcileError),
            });
          }
        }

        return Response.json({
          ok: true,
          expired: Number(expired.data ?? 0),
          reconciled,
          deferred,
        });
      },
    },
  },
});
