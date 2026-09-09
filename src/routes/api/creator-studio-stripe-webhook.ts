import { createFileRoute } from "@tanstack/react-router";
import { handleCreatorStudioStripeWebhook } from "@/lib/creator-studio-billing.server";

export const Route = createFileRoute("/api/creator-studio-stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });
        try {
          const rawBody = await request.text();
          await handleCreatorStudioStripeWebhook(rawBody, signature);
          return Response.json({ received: true });
        } catch {
          return new Response("Invalid webhook", { status: 400 });
        }
      },
    },
  },
});
