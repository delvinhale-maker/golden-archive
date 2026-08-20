import { createFileRoute } from "@tanstack/react-router";
import { sendDueSubscriberSequenceEmails } from "@/lib/subscriber-welcome-email.server";

// Public cron endpoint — schedule this to run a few times a day (e.g. every
// 6 hours) the same way /api/public/cron/release-preorders is scheduled, to
// send steps 2 and 3 of the subscriber welcome sequence to confirmed
// subscribers who are due for them.
// Authenticated via Supabase anon key `apikey` header, per platform convention.
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
          const result = await sendDueSubscriberSequenceEmails();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("subscriber-sequence cron failed", e);
          return Response.json({ ok: false, error: e?.message ?? "failed" }, { status: 500 });
        }
      },
    },
  },
});
