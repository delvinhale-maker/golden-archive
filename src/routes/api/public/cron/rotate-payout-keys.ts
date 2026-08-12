import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint — pg_cron POSTs here nightly to re-encrypt any payout
// secrets still sealed with a retired key. Idempotent and safe while live, so
// admins never have to run the pass manually from /admin/payouts.
// Authenticated via the Supabase anon key in the `apikey` header.
export const Route = createFileRoute("/api/public/cron/rotate-payout-keys")({
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
          const { scanAndRotatePayoutKeys } = await import(
            "@/lib/payout-key-rotation.server"
          );
          const report = await scanAndRotatePayoutKeys({ dryRun: false });
          const rotated =
            report.payout_methods.rotated + report.payout_requests.rotated;
          const failed =
            report.payout_methods.failed + report.payout_requests.failed;
          console.log(
            `[cron] payout key rotation: kid=${report.active_kid} rotated=${rotated} failed=${failed}`,
          );
          return Response.json({ ok: true, rotated, failed, report });
        } catch (e: any) {
          console.error("rotate-payout-keys cron failed", e);
          return Response.json(
            { ok: false, error: e?.message ?? "failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
