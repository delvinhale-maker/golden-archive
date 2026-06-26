
# Wave 1 — Checkout & Instant Delivery

Buyers purchase without signing in. They enter an email at checkout, pay via Stripe Embedded Checkout, and receive a branded email with a signed download link. The 9% platform fee is tracked per order so seller payouts can be paid out later.

## Flow

```text
Product page  ──►  "Buy now" opens Stripe Embedded Checkout (modal)
                    │
                    ▼
              Buyer enters email + card  (no account required)
                    │
                    ▼
       Stripe webhook → /api/public/webhooks/stripe
                    │
                    ├── insert order + order_items + order_downloads (signed token)
                    ├── record 9% platform fee, 91% seller balance
                    └── send branded "Your AurumVault download" email
                    │
                    ▼
       Buyer clicks email link → /download/$token
                    │
                    ▼
       Server fn validates token (not expired, < N downloads) →
       returns Supabase Storage signed URL for product-files
```

## Database (one migration)

- `orders` — id, buyer_email, stripe_session_id, stripe_payment_intent, amount_cents, currency, status, created_at
- `order_items` — id, order_id, product_id, seller_id, unit_amount_cents, platform_fee_cents (9%), seller_amount_cents (91%)
- `order_downloads` — id, order_item_id, token (unguessable), max_downloads (default 5), download_count, expires_at (90 days), created_at
- `seller_balances` — seller_id, pending_cents, paid_cents (for future payout wave)

All four tables get explicit GRANTs. RLS:
- `orders` / `order_items`: no anon, sellers can SELECT their own rows (`order_items.seller_id = auth.uid()`), admin sees all
- `order_downloads`: no direct client access — token verification runs server-side only via `supabaseAdmin`
- `seller_balances`: seller reads own row

## Stripe wiring

- `src/lib/stripe.server.ts` — gateway client (per stripe-shared-utility, verbatim)
- `src/lib/payments.functions.ts`:
  - `createProductCheckout` — accepts `{ productId, returnUrl, environment }`; resolves price from DB; creates Stripe Embedded Checkout session with `price_data` (dynamic seller-set prices); `managed_payments: { enabled: true }`; returns `clientSecret`
- `src/components/StripeEmbeddedCheckout.tsx` + `src/hooks/useStripeCheckout.tsx` — per stripe-checkout
- `src/components/PaymentTestModeBanner.tsx` — sandbox notice
- Wire "Buy now" on `ProductDetailPage.tsx` to open checkout

## Webhook

- `src/routes/api/public/webhooks/stripe.ts` (POST)
- Verify signature with `PAYMENTS_SANDBOX_WEBHOOK_SECRET` / `PAYMENTS_LIVE_WEBHOOK_SECRET`
- On `checkout.session.completed`:
  1. Insert `orders` + `order_items` rows
  2. Generate `order_downloads` row with crypto-random token, 90-day expiry, max 5 downloads
  3. Increment `seller_balances.pending_cents` by 91% of price
  4. Enqueue "Order delivery" branded email via existing `sendTransactionalEmail`

## Download delivery

- New email template `src/lib/email-templates/order-delivery.tsx` — gold/navy branded, lists items, "Download your file" CTA per item linking to `https://www.aurumvault.store/download/{token}`
- New route `src/routes/download.$token.tsx`:
  - Loader calls `getDownload` server fn → validates token + expiry + count → returns short-lived Supabase storage signed URL
  - Page shows "Your download is ready" with auto-redirect to signed URL + manual fallback button
- Server fn increments `download_count` per redemption

## Return page

- `src/routes/checkout.return.tsx` — reads `session_id` search param, shows "Payment received — your download link has been emailed to {email}"

## Files created

- `supabase/migrations/<ts>_orders.sql`
- `src/lib/stripe.server.ts`
- `src/lib/stripe.ts`
- `src/lib/payments.functions.ts`
- `src/components/StripeEmbeddedCheckout.tsx`
- `src/components/PaymentTestModeBanner.tsx`
- `src/hooks/useStripeCheckout.tsx`
- `src/routes/api/public/webhooks/stripe.ts`
- `src/routes/checkout.return.tsx`
- `src/routes/download.$token.tsx`
- `src/lib/email-templates/order-delivery.tsx`
- Edits to `ProductDetailPage.tsx` (Buy now button) and `MarketShell.tsx` (test-mode banner)

## Out of scope (later waves)

- Buyer accounts / `/library` (Wave 2) — guest checkout is the flow now
- Reviews, search/filters (Waves 3-4)
- Stripe Connect for actual seller payouts — Wave 1 just tracks the balance ledger so no money is stuck when payouts ship
