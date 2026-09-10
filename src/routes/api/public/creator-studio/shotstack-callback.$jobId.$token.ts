import { createFileRoute } from "@tanstack/react-router";
import { handleCreatorStudioProviderCallback } from "@/lib/creator-studio.callback.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[0-9a-f]{64}$/i;

export const Route = createFileRoute(
  "/api/public/creator-studio/shotstack-callback/$jobId/$token",
)({
  server: {
    handlers: {
      POST: async ({ params }) => {
        if (!UUID_RE.test(params.jobId) || !TOKEN_RE.test(params.token)) {
          return new Response("Not found", { status: 404 });
        }
        try {
          const result = await handleCreatorStudioProviderCallback(params.jobId, params.token);
          if (result.status === 401) return new Response("Unauthorized", { status: 401 });
          if (result.status === 404) return new Response("Not found", { status: 404 });
          if (result.status === 202) return Response.json({ accepted: true }, { status: 202 });
          return Response.json({ accepted: true });
        } catch (error) {
          console.error("[creator-studio] callback handling failed", {
            jobId: params.jobId,
            error: error instanceof Error ? error.message : String(error),
          });
          // A transient internal failure should not leak details to the provider.
          // 202 allows the provider/watchdog path to reconcile again safely.
          return Response.json({ accepted: true }, { status: 202 });
        }
      },
    },
  },
});
