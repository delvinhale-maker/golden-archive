# AurumVault → Full Amazon-Style Marketplace

That's 10 large feature areas. Building all at once would take many hours, blow past safe edit batches, and likely break the live site mid-flight. I want to ship this in **5 sequenced waves**, each one independently testable and publishable.

## Wave 1 — Discovery & Storefront polish
- Rotating hero banners (3 slides, autoplay, dot nav)
- Deals of the Day strip with live countdown timers
- Category grid (eBooks / Courses / Templates / Audio / Leadership)
- Bestsellers row (sorted by sales count from `orders`)
- "Customers Also Bought" on product page (category-matched fallback until we have co-purchase data)
- Skeleton loaders on all storefront grids

## Wave 2 — Product page + Reviews
- Cover zoom on hover/click, format selector (eBook / Audio / Bundle if applicable)
- Trust badges row + Kingdom Guarantee box (30-day, instant delivery, secure checkout)
- New `reviews` table (rating, title, body, verified_purchase, helpful_votes)
- Star breakdown bars, verified-purchase badge, helpful vote button
- Seed 3–5 launch reviews per existing product
- Open Graph + Twitter card tags per product (dynamic from loader)

## Wave 3 — Cart, Bundles, Promos, Checkout flow
- Slide-in cart drawer (persisted in localStorage, multi-item)
- Multi-line Stripe checkout (replaces current single-item buy-now)
- Promo code field → Stripe coupon lookup
- 3 pre-built bundles as `marketplace_products` rows with `is_bundle` flag + bundle_items
  - Kingdom Entrepreneur, Kingdom Kids, Full Access
- Flash sale banner (admin-toggleable, countdown)
- Checkout progress steps + gold confetti animation on `/checkout/return`

## Wave 4 — Search, Filters, Buyer Dashboard
- Live search dropdown in header (debounced, top 6 results)
- `/search` results page with sidebar filters: category, price slider, rating, format
- Sort controls (newest, bestselling, price asc/desc, rating)
- `/library` — buyer's purchased products with download buttons (re-uses existing token system, regenerates on demand)
- `/orders` — order history with re-download
- `/wishlist` — already have the hook, add a page
- In-app notification bell (unread count from new `notifications` table)

## Wave 5 — Admin Seller Central + PWA/SEO
- `/admin` upgrade: KPI cards (GMV, orders, sellers, pending), tabs for Products / Orders / Coupons / Sellers
- Coupon manager (creates Stripe coupons via API)
- `manifest.json`, service worker for install + offline shell
- Push notifications opt-in (web push, fires on order delivery)
- Full OG/Twitter metadata pass on every public route

## Out of scope (call out now)
- **Resend**: you already have Lovable Emails wired (notify.www.aurumvault.store). I'll extend that, not swap to Resend, unless you say otherwise.
- **Stripe Connect payouts**: still tracked-only in `seller_balances`. Real payouts to sellers are a separate buildout — flag for later.
- **Push notifications** require user permission + an icon set; will use a generated placeholder unless you upload one.

## Confirm before I start

1. **Approve the 5-wave order**, or reorder.
2. **Start with Wave 1 only** this turn, then publish + smoke-test before Wave 2? (Recommended — each wave is 8–15 files.)
3. **Resend vs. Lovable Emails** — stay on Lovable Emails? (Recommended.)
