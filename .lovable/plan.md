# Phase 3 — Bundles, Upsells & AOV Engine

## Audit findings (what already exists)

**Stack**: React 19 + TanStack Start/Router, Tailwind v4, Lovable Cloud (Postgres + RLS), Stripe embedded checkout, server functions in `src/lib/*.functions.ts`.

**Catalog / ownership**: all 44 approved+published products belong to one seller account (the AurumVault owner). Categories/subcategories exist (`product_subcategories`), prices live in `marketplace_products.price_cents`.

**Cart & checkout**: one cart store (`use-av-store.ts`), one embedded Stripe flow — `createProductCheckout` (single product + order bumps + variants) and `createCartCheckout` (multi-line, promo codes `AURUM10/VAULT20/FIRST5`, server re-prices every line). Return page `/checkout/return`.

**Orders / fulfilment / payouts**: `orders` + `order_items` + `order_downloads` tokens, created only in the Stripe webhook. Platform fee 15% per item, seller credited via `seller_balances.pending_cents`. Affiliate commissions and referrals attach per order item.

**Merchandising already present (reuse, don't duplicate)**: `product_order_bumps` (checkout upsells with admin manager), `FrequentlyBoughtTogether` + `CustomersAlsoBought` (category-derived), `creator_bundles` / `creator_bundle_items` (display-only on storefronts — "Bundle checkout coming soon"), `cta_click_events` for click analytics, `homepage_layout` for admin section ordering, admin dashboards under `src/routes/_authenticated/admin.*`.

**Gaps**: no purchasable bundle, no bundle storefront/collection page, no admin bundle builder, no explicit recommendation rules table, no ownership-aware suppression in recommendation modules, no AOV/merchandising analytics.

**Marketplace safety**: since every sellable product is AurumVault-owned today, only **Type A** bundles are in scope. Mixed-creator bundles will be blocked server-side (bundle items must all share one seller and that seller must be flagged bundle-authorized) and reported as a limitation, because creator agreements and discount-allocation rules for cross-creator discounting do not exist yet.

## What gets built

### 1. Data (one migration, additive)
- `marketplace_bundles`: name, slug, short/full description, image_url, status (`draft|active|archived`), `price_cents`, featured, `start_at`, `end_at`, `owner_seller_id`, timestamps. Savings are **computed, never stored**.
- `marketplace_bundle_items`: bundle_id, product_id, position, required.
- `product_recommendations`: product_id → recommended_product_id / recommended_bundle_id, kind (`toolkit|pairs_with|also_need|continue`), position, active.
- `merch_events`: kind (impression/click/add_to_cart/purchase/upgrade), surface, bundle_id, product_id, session_id, order_id — one place for all merchandising analytics.
- `order_items` gains `bundle_id` + `bundle_name` (nullable) so bundle purchases still create one real order item per included product: correct fulfilment, downloads, payouts, refunds and reporting stay untouched.
- Existing `creator_bundles` stays as-is (creator storefront display); the new tables power AurumVault merchandising.
- GRANTs + RLS: public read of active, in-window bundles/items/recommendations; all writes admin-only via `has_role(auth.uid(),'admin')`; `merch_events` insert-only for anon/authenticated, admin read.

### 2. Server-authoritative pricing
`src/lib/bundles.functions.ts` (public reads) and `bundles.server.ts`:
- `getBundle(slug)` returns items with live product prices, computed individual value, savings, savings %.
- If bundle price ≥ individual value: savings language suppressed and the bundle flagged `needs_review` for admin.
- `createBundleCheckout({ bundleId })`: re-reads the bundle and every item server-side, validates status/window/eligibility/single-seller, and builds the Stripe session from the DB price only. The browser never supplies a bundle price.
- Coupon stacking on bundles is **disabled** (bundles are already the discount) — enforced in the checkout handler.

### 3. Fulfilment (webhook)
`handleCheckoutCompleted` gains a bundle branch: metadata `bundle_id` → insert one `order_items` row per included product, with the bundle discount allocated **pro-rata by list price** (largest-remainder so cents sum exactly to charged total), 15% fee per line as today, download token per line, and confirmation/delivery emails listing the bundle name plus each included title.

### 4. Admin
- `/admin/bundles` — list + builder: name/slug, product picker (search, add, reorder, required flag), price, artwork, descriptions, live individual value / savings / %, schedule, activate/deactivate, feature, preview link, per-bundle performance (views, add-to-cart, purchases, conversion, revenue — all from real `merch_events` / `order_items`).
- `/admin/merchandising` — AOV (current vs previous comparable period), items per order, bundle revenue & orders, bundle attach rate, cross-sell conversion, best bundle, weakest step. Metrics render "not enough data" rather than fabricated numbers.
- `/admin/recommendations` — define product → product/bundle relationships per kind.

### 5. Storefront
- `/bundles` collection page ("Build More. Save More.") and `/bundles/$slug` detail page: hero, artwork, individual value, bundle price, savings, "What's included" reusing existing product titles/covers/prices with links, single CTA.
- Product page: **Bundle & Save** module when the product belongs to an active bundle; **Complete Your Toolkit** driven by `product_recommendations` with category fallback. Existing "Frequently bought together" is relabelled **Pairs Well With** until real co-purchase data exists.
- Cart: restrained "Complete Your Toolkit" + **bundle upgrade** offer — exact delta (bundle price − value of matching cart lines), and accepting it removes the superseded cart lines and adds the bundle line, so nothing is charged twice.
- `/checkout/return`: "Continue Building" recommendations below the downloads panel, never above it.
- Homepage: one restrained "Curated Bundles" band (2–4 bundles) inserted through the existing `homepage_layout` ordering so it can be moved or hidden.
- Search: bundles surface in `/search` results under their own group, ranked below directly-matching products.
- Owned-product awareness: recommendation and upsell surfaces suppress items the signed-in buyer already owns (reusing `use-owned-products`).

### 6. Analytics wiring
Impressions, clicks, add-to-cart, upgrade accepted, and purchases logged to `merch_events` with a `surface` tag (pdp / cart / homepage / bundle_page / post_purchase) and offer version field, so later A/B tests can read it — no experiment platform built.

### 7. Tests
Vitest (unit/integration): pro-rata discount allocation sums to charged total; savings suppressed when negative; tampered bundle price rejected; inactive/expired/out-of-window bundle rejected; mixed-seller bundle rejected; coupon+bundle stacking rejected; upgrade delta math; owned-product suppression; AOV/attach-rate calculations. Playwright/preview checks at 390 px, tablet and desktop for the bundle page, cart upsell and post-purchase module. Results reported exactly as they run.

## Implementation order
1. Migration + RLS/GRANTs → 2. server pricing/read functions + tests → 3. checkout + webhook fulfilment + tests → 4. admin builder → 5. bundle storefront pages → 6. PDP / cart / post-purchase / homepage / search surfaces → 7. analytics + admin dashboards → 8. responsive & a11y pass → 9. bundle recommendations report.

## Risks / limitations
- Mixed-creator bundles blocked by design until creator authorization + discount-allocation terms exist.
- Refunds today are handled manually in Stripe; bundle refunds will need every child order item reversed together — I'll document the procedure and keep allocation per-line so reversal is deterministic, but automated refund reversal is out of scope unless you want it.
- Baseline AOV lift cannot be claimed until post-launch data accumulates; the dashboard will show periods, not causal lift.
- No bundle is published automatically — after build I'll present candidate bundles (Kingdom/Realtor content vaults, planner sets, children's dictionary set, etc.) with real individual values and recommended prices for your approval.
