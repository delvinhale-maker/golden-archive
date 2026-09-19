import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint — pg_cron POSTs here daily to send License Wallet
// expiration reminders (60/30/21/14/7/3/1 days before, plus expiry day).
// Idempotent per (document, lead time, expiration date).
// Authenticated via the Supabase publishable key in the `apikey` header, the
// same convention as /api/public/cron/subscriber-sequence.
export const Route = createFileRoute("/api/public/cron/license-wallet-reminders")({
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
          const { runLicenseWalletReminders } = await import("@/lib/license-wallet-reminders.server");
          const result = await runLicenseWalletReminders();
          console.log(
            `[cron] license-wallet-reminders candidates=${result.candidates} sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`,
          );
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("license-wallet-reminders cron failed", e);
          return Response.json({ ok: false, error: e?.message ?? "failed" }, { status: 500 });
        }
      },
    },
  },
});