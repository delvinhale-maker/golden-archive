# Creator Storefronts — Audit + Build Plan

## Audit: what already exists (and will be reused, not rebuilt)

| Area | Current state | Verdict |
| --- | --- | --- |
| Framework / routing | TanStack Start, file routes in `src/routes`, server functions | Reuse |
| Auth / roles | `use-auth` + `user_roles` + `has_role`, `_authenticated` gate | Reuse |
| Creator record | `seller_applications` (status approved, `brand_name`, `brand_slug`, `pitch`, `country`, `website`, `categories`, `social_links`, `cover_url`, `extended_bio`, `story`, `credentials`, `featured_media_url`) + `profiles` (display name, avatar) | Reuse — no new creator table |
| Public storefront | `/store/$slug` — full page: cover, avatar, bio, tabs (products / categories / about / reviews / bundles), follow, native share, canonical + OG + Person & Breadcrumb JSON-LD | Reuse and extend |
| Creator editor | `/dashboard/storefront` — cover upload, bio/story/credentials/media, bundle builder | Reuse and extend |
| Products | `marketplace_products.seller_id`, filtered to `status=approved AND published=true` | Correct already |
| Bundles | `creator_bundles` + `creator_bundle_items` (same-creator, seller-scoped) | Reuse |
| Founding 100 | `founding_creators`, `getFoundingNumberForUser`, `FoundingCreatorBadge`, `StorefrontFoundingBadge`, launch kit at `/dashboard/launch-kit` with QR | Reuse — server-authoritative already |
| Reviews | `product_reviews` with `verified_purchase` | Reuse for real aggregate only |
| Earnings/payouts | `earnings.functions.ts`, payout schedule, 85/15 | Reuse — no new payout math |
| Checkout | Stripe webhook fulfilment | Untouched |
| Discovery | `/creators` browse page with search + category filter | Reuse |

### Real gaps to close
1. No `/creator/:slug` alias — current public URL is `/store/:slug`.
2. No reserved-slug / normalization guard on `brand_slug`.
3. Creator cannot pick **featured products**.
4. No **storefront view / click attribution** and no **creator analytics** page (views, product views, orders, units, gross vs earnings, top products, traffic sources).
5. Product page names the creator but does not link to their storefront or show founding status; no "More from this creator".
6. No QR/share panel inside the storefront editor (QR only lives in the launch kit).
7. No admin moderation actions for storefront identity fields.

## What I will build

### 1. Data (one migration)
- `creator_storefront_settings` — `user_id` PK, `headline`, `accent` (enum of approved presets), `featured_product_ids uuid[]`, `featured_bundle_id`, `logo_url`. Owner-write RLS, public read; GRANTs for `anon`/`authenticated`/`service_role`.
- `creator_storefront_events` — `creator_user_id`, `kind` (`storefront_view` | `product_click` | `share` | `qr`), `product_id`, `utm_source/medium/campaign`, `created_at`. Insert allowed for `anon`+`authenticated`; **SELECT only by the owning creator or admin** (no cross-creator reads, no PII stored).
- Reserved-slug guard: SQL function + trigger rejecting `admin, support, aurumvault, checkout, login, creators, account, marketplace, store` and enforcing normalized unique slugs.

### 2. Routes
- `src/routes/creator.$slug.tsx` — canonical creator URL; renders the same storefront and 301-style redirects/canonicals so `/store/:slug` links keep working (canonical points at one of them only).
- `src/routes/_authenticated/dashboard.analytics.tsx` — creator's own metrics, server-scoped to `context.userId`.
- Storefront editor gains: Identity (headline, logo, accent preset), Merchandising (pick 3–6 featured products, featured bundle), Share panel (copy link, QR preview + PNG download, native share), and "View public storefront".

### 3. Components
- `CreatorFeaturedProducts`, `CreatorStorefrontShare` (share + QR), `MoreFromCreator` (product page row), creator identity block on the PDP with storefront link + founding badge.

### 4. Security
- Featured product ids validated server-side against `seller_id = auth.uid()` before save; another creator's product is rejected.
- Social/website URLs validated server-side: `https:` only, no `javascript:`, length capped; rendered with `rel="noopener noreferrer nofollow"`.
- Analytics server functions take **no creator id from the client** — identity comes from the bearer token.
- Founding number and seller approval remain unwritable by creators (existing RLS, re-verified).

### 5. SEO / social
- Per-creator unique title/description/canonical/OG already present; extended with `logo_url` fallback and `robots: noindex` for non-approved. Creator pages added to `sitemap.xml`.

### 6. Tests (executed, results reported)
- Unit: slug normalization + reserved words, URL validation, featured-product ownership filter, earnings vs gross split.
- Integration: approved storefront loads / unapproved 404s; another creator's product cannot be featured; analytics cannot be read for another creator id.
- Playwright: public storefront + editor + analytics at 375/390/tablet/desktop.

## Order of work
1. Migration + RLS/GRANTs.
2. Server functions (settings, featured products, analytics, event logging).
3. `/creator/:slug` route + shared storefront extraction.
4. Editor sections (identity, merchandising, share/QR).
5. Creator analytics page.
6. PDP creator identity + "More from this creator".
7. Admin moderation actions.
8. Tests + mobile verification.

## Risks
- `/store/:slug` is already indexed; introducing `/creator/:slug` needs a single canonical to avoid duplicate content — I will canonicalize to `/creator/:slug` and keep `/store/:slug` serving with a canonical pointing to the new URL.
- Storefront view events are high-volume; inserts stay fire-and-forget and aggregation is done in SQL, not the client.
- Creator ratings will only be shown when real `product_reviews` rows exist — no synthesized averages.
