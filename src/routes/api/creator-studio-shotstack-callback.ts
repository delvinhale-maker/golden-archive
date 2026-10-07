import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { parseUntrustedShotstackCallback } from "@/lib/creator-studio-shotstack.server";
import {
  callbackTokenMatches,
  refreshCreatorStudioRender,
} from "@/lib/creator-studio-rendering.server";

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
        const token = new URL(request.url).searchParams.get("token");
        if (!callbackTokenMatches(token)) return new Response("Unauthorized", { status: 401 });
        try {
          // Shotstack callbacks are wake-up hints only. Provider GET remains authoritative.
          const callback = parseUntrustedShotstackCallback(await request.json());
          if (callback.type !== "edit" || callback.action !== "render") {
            return Response.json({ received: true });
          }
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
          return new Response("Invalid callback", { status: 400 });
        }
      },
    },
  },
});
