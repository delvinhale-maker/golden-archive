# AurumVault Premium Marketplace Upgrade — Phased Plan

You picked all four scope areas plus a **platform-wide royalty change from 91% → 70%**. That is 3–5 build turns of work. Shipping it as one turn produces half-finished features across the app. Below is the sequence I'll follow. Each phase is self-contained and shippable.

---

## Phase 1 — Creator marketing page + royalty change (this turn)

**Royalty migration (91% → 70%)**
- Global replace of "91%" / "9% platform fee" copy across: `/sell`, seller emails (`seller-application-received`, `seller-application-approved`), `creator-agreement.tsx`, dashboard earn page, any FAQ/about copy.
- Update any payout math in `payout-schedule.functions.ts` / `payments.functions.ts` if it hardcodes the split (will confirm during implementation — otherwise it's config-driven).
- No changes to existing `seller_balances` rows; new orders use the new split.

**New `/become-a-creator` marketing page (separate from `/sell`)**
- Premium hero: "Your Knowledge. Your Empire. Your Vault." + subtitle
- Three-column value props: 70% Royalties / AI-Powered Tools / Built-In Audience
- Social proof bar with hardcoded placeholders you'll supply (e.g. `{creatorCount}`, `{productCount}`, `{countryCount}` — I'll leave them as visible TODO constants at the top of the file)
- Sections: "How it works" (3 steps), "What you can sell" (product-type grid), "Creator tools" (feature grid teasing AI tools), testimonials slot, FAQ, final CTA → `/sell`
- Full SEO head() with route-specific title/description/OG
- Design language: navy `#1B2A4A`, gold `#C9A84C`, Cormorant Garamond display — matches existing `AurumHero` DNA

**4-step application form (rebuilt on `/sell`)**
- Step 1: About you (brand/creator name, email confirmation, country)
- Step 2: What you'll sell (product types multi-select, category, price range)
- Step 3: Your work (pitch, website/portfolio, social links)
- Step 4: Agreement + submit (creator agreement checkbox, tax acknowledgment)
- Progress bar, back/next nav, per-step validation with zod
- Persists to existing `seller_applications` table — will add nullable columns via migration: `country`, `social_links jsonb`, `categories text[]`, `price_range text`
- Keeps the existing approved-application email flow

---

## Phase 2 — Buyer-side premium features (next turn)

- Curated collections (admin-editable shelves beyond Kingdom Picks)
- Reviews v2: verified purchase badge, photo reviews already exist → add sort/filter, review response from seller, helpful count already present
- Wishlist collections (named lists)
- "Bought together" bundles pricing
- Premium PDP polish: sticky buy card, richer previewer, author card

## Phase 3 — Creator dashboard upgrades

- Revenue analytics: line chart (30/90/365), top-products table, conversion funnel
- Payout timeline + next-release ETA
- Product performance: views → cart → purchase per product
- Traffic sources: organic vs referral vs affiliate
- Email capture per product

## Phase 4 — AI-powered creator tools (Lovable AI Gateway)

- Cover generator (imagegen)
- Product description writer (Gemini)
- Price recommender (heuristic + AI comp analysis)
- SEO title/meta generator per product
- All wired through `src/lib/ai-gateway.server.ts`

---

## Technical notes

- One migration in Phase 1 (add columns to `seller_applications`). No breaking schema changes.
- The 70% split is copy-only unless payout math hardcodes 0.91 — I'll grep and confirm before touching payout logic.
- Social proof numbers ship as TODO constants at the top of `/become-a-creator.tsx` for easy hand-editing.
- Every new route gets its own head() metadata (no OG image on `__root`).

---

## What I need from you

**Approve this plan** and I ship Phase 1 in the next turn. Say "just Phase 1 form" or "skip royalty change" if you want to narrow further.
