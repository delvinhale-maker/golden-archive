## Goal
Admin-editable ordering of homepage sections and Vault Finds affiliate bands, persisted in the database and reflected on the live site without redeploying.

## What ships

### 1. Database
New table `homepage_layout`:
- `key` (text, unique) — stable ID per section (e.g. `featured_products`, `vault_finds_grid`)
- `kind` (`'section' | 'affiliate'`) — which list it belongs to
- `position` (int) — sort order within its list
- `enabled` (bool) — reserved for future use, defaults true (out of scope for this pass; not exposed in UI)
- `label` (text) — human-readable name shown in the admin UI
- Seeded with every current homepage row and every Vault Finds band, in their existing order.
- RLS: public read (anon + authenticated); admin-only write via `has_role`.

### 2. Server functions (`src/lib/homepage-layout.functions.ts`)
- `getHomepageLayout()` — public read; returns two ordered arrays (sections, affiliates).
- `saveHomepageLayout({ kind, orderedKeys })` — admin-only; updates `position` per key atomically.

### 3. Admin page — `/admin/homepage`
- Route: `src/routes/_authenticated/admin.homepage.tsx`
- Two side-by-side drag-and-drop lists (Homepage Sections / Affiliate Bands).
- Pointer-event based drag (same pattern already used in `VaultFindsGrid`) so it works on mobile.
- Save persists via `saveHomepageLayout`; success toast; invalidates the layout query.
- Non-admins are redirected home.
- Linked from the existing admin index page.

### 4. Homepage renderer
- Introduce a keyed registry in `src/routes/index.tsx`:
  ```ts
  const SECTION_REGISTRY: Record<string, () => JSX.Element> = { ... }
  const AFFILIATE_REGISTRY: Record<string, () => JSX.Element> = { ... }
  ```
- `Home()` fetches the layout (`useSuspenseQuery`) and renders sections in the configured order, then the affiliate band header, then affiliate rows in the configured order.
- Fixed anchors preserved as-is (Hero, CategoryCTABar, TrustBar, RefreshBar, ContinueBrowsing, AffiliateBandHeader, closing sections such as HeroStatsBar/TopCreators/WhyAurumVault/KingdomBibleApp/EmailCapture). Only the middle content rows and the affiliate rows are reorderable in this pass — matches "reorder sections" + "reorder affiliate bands independently" and avoids breaking the hero/footer chrome.

### Section keys exposed to admin
Sections: `new_releases`, `kingdom_picks`, `category_grid`, `featured_products`.
Affiliates: `vault_finds_row`, `vault_finds_grid`, `vault_finds_category_sections`.

## Out of scope (can add later)
- Toggling sections on/off (schema supports it; UI not built this pass).
- Renaming titles/kickers.
- Reordering hero/footer chrome.

## Verification
- Migration runs and seeds all keys.
- `/admin/homepage` renders for admin, redirects otherwise; drag reorders persist after reload.
- Homepage reflects the saved order on next navigation (query invalidated on save).
- Non-admin visits to the homepage load layout via the anon-readable server fn.

## Files
- `supabase migration` — new table + seed + RLS.
- `src/lib/homepage-layout.functions.ts` — new.
- `src/routes/_authenticated/admin.homepage.tsx` — new.
- `src/routes/index.tsx` — refactor middle section render + affiliate rows to use layout.
- `src/routes/_authenticated/admin.index.tsx` — add link tile (small edit).
