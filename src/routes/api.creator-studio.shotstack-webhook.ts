import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/creator-studio/shotstack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const payload = await request.json().catch(() => null) as any;
        const providerRenderId = typeof payload?.id === "string"
          ? payload.id
          : typeof payload?.response?.id === "string"
            ? payload.response.id
            : typeof payload?.render?.id === "string"
              ? payload.render.id
              : null;

        const { handleCreatorStudioShotstackWebhook } = await import("@/lib/creator-studio-webhook.server");
        try {
          const result = await handleCreatorStudioShotstackWebhook({ token, providerRenderId });
          return Response.json(result.body, { status: result.status });
        } catch {
          return Response.json({ ok: false }, { status: 502 });
        }
      },
    },
  },
});
