import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint — pg_cron POSTs here to advance the Creator Starter Pack
// nurture sequence (days 2, 4, 7, 10) for leads who explicitly opted into
// marketing. Idempotent per step, so extra runs are harmless.
// Authenticated via the Supabase publishable key in the `apikey` header, same as
// /api/public/cron/subscriber-sequence.
export const Route = createFileRoute("/api/public/cron/starter-pack-nurture")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runStarterPackNurture } = await import("@/lib/starter-pack-nurture.server");
          const result = await runStarterPackNurture();
          console.log(
            `[cron] starter-pack-nurture sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`,
          );
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("starter-pack-nurture cron failed", e);
          return Response.json({ ok: false, error: e?.message ?? "failed" }, { status: 500 });
        }
      },
    },
  },
});
