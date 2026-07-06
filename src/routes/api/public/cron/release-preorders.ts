import { createFileRoute } from "@tanstack/react-router";
import { releaseDuePreorders } from "@/lib/preorders.functions";

// Public cron endpoint — pg_cron POSTs here daily to release pre-orders whose
// release_date has passed and email download links to their buyers.
// Authenticated via Supabase anon key `apikey` header, per platform convention.
export const Route = createFileRoute("/api/public/cron/release-preorders")({
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
          const result = await releaseDuePreorders();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("release-preorders cron failed", e);
          return Response.json({ ok: false, error: e?.message ?? "failed" }, { status: 500 });
        }
      },
    },
  },
});
