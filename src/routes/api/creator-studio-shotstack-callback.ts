import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { parseUntrustedShotstackCallback } from "@/lib/creator-studio-shotstack.server";
import { refreshCreatorStudioRender } from "@/lib/creator-studio-rendering.server";

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Creator Studio service database is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const Route = createFileRoute("/api/creator-studio-shotstack-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Shotstack callbacks are treated only as wake-up hints. Never trust callback status/url.
          const callback = parseUntrustedShotstackCallback(await request.json());
          const db = serviceClient();
          const { data: job } = await db
            .from("creator_studio_render_jobs")
            .select("owner_user_id")
            .eq("provider_render_id", callback.id)
            .maybeSingle();
          if (!job?.owner_user_id) return Response.json({ received: true });
          await refreshCreatorStudioRender({
            ownerUserId: job.owner_user_id,
            providerRenderId: callback.id,
          });
          return Response.json({ received: true });
        } catch {
          // Do not leak provider/database details to an unauthenticated callback caller.
          return new Response("Invalid callback", { status: 400 });
        }
      },
    },
  },
});
