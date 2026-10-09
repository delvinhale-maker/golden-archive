import { createFileRoute } from "@tanstack/react-router";
import { handleFoodOsStripeWebhook } from "@/lib/food-os-billing.server";

export const Route = createFileRoute("/api/food-os/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        if (!signature) return Response.json({ error: "Missing Stripe signature" }, { status: 400 });
        const body = await request.text();
        try {
          const handled = await handleFoodOsStripeWebhook(body, signature);
          return Response.json({ received: true, handled });
        } catch (error) {
          if (error instanceof Error && (/signature|webhook payload/i).test(error.message)) {
            return Response.json({ error: "Invalid Stripe signature" }, { status: 400 });
          }
          console.error("Food OS webhook processing failed", error);
          return Response.json({ error: "Webhook processing failed" }, { status: 500 });
        }
      },
    },
  },
});
