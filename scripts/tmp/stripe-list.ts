import { createStripeClient } from "../../src/lib/stripe.server";
const s = createStripeClient("live");
const list = await s.checkout.sessions.list({ limit: 10 });
for (const c of list.data) {
  console.log(c.id, new Date(c.created*1000).toISOString(), c.payment_status, c.status, c.amount_total, c.customer_details?.email, JSON.stringify(c.metadata));
}
