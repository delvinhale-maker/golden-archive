import { createFileRoute } from "@tanstack/react-router";

/**
 * Dynamic QR redirect service. A pure server route — no React component,
 * no dashboard bundle load — matching the lightweight server-handler
 * pattern already used by api/public/health/categories.ts elsewhere in
 * this codebase. This is the only place that reads qr_projects for an
 * unauthenticated caller, and it does so exclusively through the
 * service-role client, never through an RLS-bound anon/authenticated
 * client — qr_projects has no public SELECT policy at all (see the
 * migration), so this handler is the sole path a scan can resolve through.
 *
 * The redirect target comes only from the database row resolved by
 * public_id — the request's query string is never consulted, so
 * /q/{id}?url=https://malicious.example cannot override the stored
 * destination (Section 13).
 */
const PUBLIC_ID_RE = /^[0-9a-f]{16,64}$/;

// Prefixes a stored, already-validated destination is allowed to redirect
// through. Kept narrower than validateDestination's input rules, since a
// stored value is already prefixed (mailto:/tel:/sms:) or a bare https URL
// — this is a defense-in-depth re-check at redirect time, not the primary
// validation gate (that happens at write time in qr.functions.ts).
function isRedirectableDestination(destination: string): boolean {
  return (
    destination.startsWith("https://") ||
    destination.startsWith("mailto:") ||
    destination.startsWith("tel:") ||
    destination.startsWith("sms:")
  );
}

function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const PAGE = (title: string, message: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · AurumVault</title></head>
<body style="font-family:system-ui,sans-serif;background:#0B1424;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center;">
<div><h1 style="font-size:20px;margin:0 0 8px;">${title}</h1><p style="color:rgba(255,255,255,.7);margin:0;">${message}</p></div>
</body></html>`;

export const Route = createFileRoute("/q/$publicId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const publicId = params.publicId;
        if (!PUBLIC_ID_RE.test(publicId)) {
          return textResponse(404, PAGE("QR code not found", "This code isn't valid."));
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: project } = await supabaseAdmin
          .from("qr_projects" as never)
          .select("id,mode,status,destination" as never)
          .eq("public_id" as never, publicId)
          .maybeSingle();

        const row = project as unknown as {
          id: string;
          mode: string;
          status: string;
          destination: string;
        } | null;

        // Invalid/unknown token: safe 404, no hint of whether nearby ids
        // exist, no owner info, no destination.
        if (!row || row.mode !== "dynamic") {
          return textResponse(404, PAGE("QR code not found", "This code isn't valid."));
        }

        if (row.status === "archived") {
          return textResponse(
            410,
            PAGE("QR code unavailable", "This QR code is no longer active."),
          );
        }

        if (row.status === "paused") {
          return textResponse(
            200,
            PAGE("QR code paused", "This QR code is currently paused by its owner."),
          );
        }

        if (!isRedirectableDestination(row.destination)) {
          // Fails safe rather than redirecting through an unrecognized
          // stored value — should be unreachable given write-time
          // validation, but the redirect must never trust a stored value
          // it can't classify as safe.
          return textResponse(404, PAGE("QR code not found", "This code isn't valid."));
        }

        // Scan recording: one minimal, awaited insert before the redirect.
        // This deployment has no confirmed background-execution primitive
        // (no verified waitUntil-equivalent exposed to this route handler
        // in this TanStack Start / Lovable runtime), so "redirect first,
        // write later" risks the write never happening at all on a
        // serverless/edge runtime that can terminate work after the
        // response is sent. A single awaited insert keeps the added
        // latency to one small write, and any failure is swallowed —
        // analytics never blocks or fails a valid redirect.
        try {
          await supabaseAdmin.from("qr_scan_events" as never).insert({
            qr_project_id: row.id,
          } as never);
        } catch {
          // Scan recording is best-effort only; the redirect must still succeed.
        }

        return Response.redirect(row.destination, 302);
      },
    },
  },
});
