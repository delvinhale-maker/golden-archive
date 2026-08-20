import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint — pg_cron POSTs here every 6 hours to send steps 2 and 3
// (day-3 and day-6 follow-ups) of the subscriber welcome sequence to confirmed
// subscribers who are due. Idempotent, so extra runs are harmless.
// Authenticated via the Supabase anon key in the `apikey` header, same as
// /api/public/cron/release-preorders.
export const Route = createFileRoute("/api/public/cron/subscriber-sequence")({
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
          const { runSubscriberSequence } = await import("@/lib/subscriber-sequence.server");
          const result = await runSubscriberSequence();
          console.log(
            `[cron] subscriber-sequence sent=${result.sent} failed=${result.failed}`,
          );
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("subscriber-sequence cron failed", e);
          return Response.json({ ok: false, error: e?.message ?? "failed" }, { status: 500 });
        }
      },
    },
  },
});
