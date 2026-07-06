# Batch 3 — Pre-orders, Order-Bumps, and Photo Reviews

Three revenue/social-proof features that plug into the existing product + checkout flow. No changes to affiliates (batch 1) or variants (batch 2).

## 1. Pre-orders

Let creators list a product before files are ready. Buyers can order now and get automatic delivery on release day.

**Creator (product editor):**
- New "Release" section with a "Pre-order" toggle
- If on: set a `release_date` and optional "pre-order note" (e.g. "Ships March 15")
- Files can be uploaded now OR left empty until closer to release
- On release day (or when the creator flips "Release now"), buyers are auto-emailed the download link

**Buyer (product page):**
- Big "Pre-order" badge with release date + countdown
- Button says "Pre-order now" instead of "Buy now"
- Download page shows "Available on {release_date}" until released
- Order confirmation email mentions pre-order + expected release

**Backend:**
- Add `is_preorder`, `release_date`, `preorder_note`, `released_at` to `marketplace_products`
- Order-item snapshot: `is_preorder_at_purchase` (bool)
- pg_cron daily job: find products where `release_date <= now()` and `released_at is null`, mark released, queue delivery emails for all pre-order buyers via existing email queue
- Manual "Release now" action on creator dashboard

## 2. Order-Bump Upsells

One-click add-on at checkout — "Add {bump product} for +$X, one time only."

**Creator (product editor):**
- New "Order bumps" section: pick up to 3 other products from your catalog
- Set a discount % applied only when bought as a bump (default 0)
- Preview shows what the buyer will see

**Buyer (checkout page):**
- Above the Stripe form: card(s) with cover, title, bump price, and a checkbox
- Checking one instantly updates the checkout total
- On success, all selected items appear in the order and download list

**Backend:**
- New table `product_order_bumps`: `product_id`, `bump_product_id`, `discount_percent`, `sort_order`
- Extend checkout server fn to accept `bumpProductIds: string[]`, validate each is an active bump for the primary product, snapshot bump price into a second `order_items` row
- Bump items participate in affiliate commission on the same referral (batch 1)

## 3. Photo Reviews

Reviews already support one `photo_url`. Expand to a real gallery + submission UI.

**Buyer (leave review):**
- Existing review form gains a photo uploader (drop / select up to 4 images)
- Client-side compress to ≤ 2 MB, upload to existing `review-photos` bucket
- Preview thumbnails before submit

**Product page:**
- New "Customer photos" strip above the reviews list — thumbnails from recent reviews with photos
- Click a thumbnail → lightbox with the review text + rating alongside
- Individual review cards show up to 4 inline photos

**Backend:**
- New table `review_photos`: `review_id`, `storage_path`, `sort_order`, `width`, `height`
- Keep existing `product_reviews.photo_url` populated with the first photo for back-compat and email templates
- List function returns array of signed URLs per review

## Files touched

- Migration: preorder columns, `product_order_bumps`, `review_photos`, GRANTs + RLS
- `src/lib/preorders.functions.ts` — creator toggle, release-now, cron endpoint
- `src/lib/order-bumps.functions.ts` — CRUD + validation
- `src/lib/reviews.functions.ts` — extend submit + list with photo arrays
- `src/routes/api/public/cron/release-preorders.ts` — cron endpoint
- Editor: Release panel + Order-bumps panel on product editor
- `src/components/marketplace/OrderBumps.tsx` — checkout upsell UI
- `src/components/marketplace/ReviewPhotoGallery.tsx` + lightbox
- Existing product page: pre-order badge/countdown, photo strip
- Checkout server fn: accept bump ids, snapshot rows
- Download resolver / delivery email: gate on `released_at` for pre-order items

## Not in this batch

- Subscriptions / recurring products
- Waitlists for out-of-stock
- Refunds UI (still admin-only via Stripe dashboard)

Reply "go" to build it, or tell me what to adjust (e.g. skip pre-orders, do only bumps + photos).
