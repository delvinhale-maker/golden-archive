# Batch 1 — Per-Creator Affiliate Program

## Scope

Each creator can enable an affiliate program on their own products, set a commission rate, and share unique referral links. When a buyer arrives via that link and purchases the creator's product, the referral is recorded and commission owed is calculated. Creator sees performance in their Earnings tab. **Payments are tracked only** — the creator pays affiliates outside the platform.

This is Batch 1 of 3. Batches 2 and 3 are proposed at the bottom for confirmation.

## What the user (creator) gets

1. **New "Affiliate Program" tab** in the creator dashboard
   - Toggle "Enable affiliate program"
   - Set default commission rate (default 20%, min 1%, max 50%)
   - Copy shareable "Become an affiliate" link
   - Table of active affiliates: name, sign-up date, clicks, sales, commission earned, commission owed
2. **Affiliate sign-up page** at `/a/{creator-slug}` — any signed-in user can join a creator's program
3. **Affiliate dashboard** at `/dashboard/affiliate` for people promoting others' products
   - Their unique referral link per creator
   - Copy-link button
   - Sales, clicks, commission earned across all creators they promote
4. **Buyer flow (invisible)**
   - Landing on `?ref={code}` stores the referral cookie for 30 days
   - On purchase, the referral is attributed to the order and commission is recorded

## What the buyer sees

Nothing new — the referral link just adds `?ref=xyz` to the product URL and drops a cookie. No banner, no disclosure UI in this batch.

---

## Technical details

### New tables

```text
creator_affiliate_programs
  creator_id (PK, FK auth.users)
  enabled boolean
  commission_rate_pct numeric(5,2)  -- default 20.00
  terms text (nullable)
  created_at, updated_at

creator_affiliates             -- one row per (affiliate, creator) pair
  id uuid PK
  creator_id FK auth.users
  affiliate_user_id FK auth.users
  referral_code text UNIQUE     -- short random slug, e.g. "delvin-a7f3"
  status text  -- active | disabled
  joined_at
  UNIQUE(creator_id, affiliate_user_id)

affiliate_referral_clicks
  id, referral_code, product_id (nullable), clicked_at, ip_hash (nullable)

affiliate_commissions
  id
  order_id FK orders
  order_item_id FK order_items
  creator_id, affiliate_user_id, referral_code
  sale_amount_cents
  commission_rate_pct  (snapshotted)
  commission_cents
  status text  -- pending | paid | void
  created_at
```

RLS: creators read their own program/affiliates/commissions; affiliates read their own rows; admins read all. GRANTs per project convention.

### Attribution wiring

- Reuse existing `orders.referral_code` and `orders.referrer_user_id` columns.
- Product pages already receive `?ref=` (extend if not) → store in cookie `av_ref` (30-day) + localStorage.
- Checkout `createServerFn` reads cookie, resolves to a `creator_affiliates` row, and only attributes if the referred product's `seller_id` matches the affiliate's `creator_id`. Cross-creator referrals are ignored.
- After order finalization, insert one `affiliate_commissions` row per qualifying `order_item`.

### New routes/files

- `src/routes/_authenticated/dashboard.affiliate-program.tsx` — creator's program settings + affiliates table
- `src/routes/_authenticated/dashboard.affiliate.tsx` — affiliate dashboard (promoting others)
- `src/routes/a.$creatorSlug.tsx` — public "become an affiliate" landing (requires sign-in to join)
- `src/lib/affiliate.functions.ts` — `getProgram`, `updateProgram`, `listMyAffiliates`, `joinProgram`, `getMyAffiliateStats`, `logReferralClick`
- Migration for the 4 tables + RLS + GRANTs
- Extend the existing checkout server fn to record commissions
- Add tiny `ReferralCapture` client hook mounted in `__root.tsx` to persist `?ref=` in cookie

### Earnings tab addition

Add a "Affiliate commissions owed" summary card + list to the existing creator earnings page.

---

## Not included in Batch 1 (deferred)

- Automatic payment of affiliate commissions (would require touching `seller_balances` / payout flow — you chose tracked-only)
- Affiliate approval workflow (auto-approve for now; creator can disable later)
- Affiliate marketing assets (banners, swipe copy)
- Public affiliate leaderboard

---

## Proposed Batches 2 & 3

**Batch 2 — Pricing & licensing** (shared "product variants" system):
- Product Tiers/Versions (Basic/Pro/Premium with different files)
- License types (Personal / Commercial / Extended) as variant labels with their own prices
- Pay What You Want (variant flag + minimum floor)

**Batch 3 — Merchandising & engagement:**
- Pre-orders (release date, badge, countdown, delayed download)
- Order-bump upsells
- Photo reviews + creator "Featured Review"

Confirm the plan and I'll build Batch 1.
