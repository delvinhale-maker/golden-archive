import { createStripeClient } from "../../src/lib/stripe.server";
import { handleCheckoutCompleted } from "../../src/routes/api/public/payments/webhook";
const s = createStripeClient("live");
const session = await s.checkout.sessions.retrieve("cs_live_a1FfygBfkfxgiIMEf1YSYkykhneP6cpREnGJw8qh6jFzEj88xaKQ9KiKKh");
await handleCheckoutCompleted(session as any, "live");
console.log("done");
