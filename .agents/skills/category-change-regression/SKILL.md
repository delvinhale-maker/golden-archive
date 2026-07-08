---
name: category-change-regression
description: Regression checklist to run after adding, removing, renaming, or reordering marketplace categories in AurumVault. Use whenever category slugs, labels, or the hidden/visible set change in src/lib/categories.ts, src/components/marketplace/MarketHeader.tsx, src/components/marketplace/CategoryGrid13.tsx, or src/routes/products.index.tsx.
---

# Category Change Regression Checklist

Run every item after any change to the category set. Categories touch five browse surfaces that must stay in sync.

## Sources of truth

- `src/lib/categories.ts` — `CATEGORIES` (13 defs), `LEGACY_ALIAS`, `slugToLabel`, `labelToSlug`, `getCategoryDef`.
- `src/routes/products.index.tsx` — `HIDDEN_CATEGORY_SLUGS` set and `CATEGORIES = CATEGORY_DEFS.filter(...).map(label)` (filter chips + sidebar).
- `src/components/marketplace/MarketHeader.tsx` — hardcoded `CATEGORIES` array of 5 short tabs (All, eBooks, Journals, Prompt Packs, Financial Planners).
- `src/components/marketplace/CategoryGrid13.tsx` — home Browse by Category grid, has its own `.filter()` of hidden slugs.
- `src/components/marketplace/CategoryIcons.tsx` — icons keyed by slug.
- `src/lib/product-types.ts` and `src/integrations/supabase/types.ts` — DB enum values. Never rename an enum without a migration.

If a category is hidden, filter it in **both** `products.index.tsx` and `CategoryGrid13.tsx`. If a category is added, add its icon in `CategoryIcons.tsx` and its def in `categories.ts`.

## Verification steps

### 1. Static grep — no orphan references

```bash
rg -n "business_operating_systems|bible_studies|digital_toolkits|budget_spreadsheets" src/
```

Any removed slug should appear only in `categories.ts` (for `LEGACY_ALIAS` back-compat), `product-types.ts`, and `types.ts`. It must NOT appear in any component under `src/components/marketplace/` or in any route under `src/routes/` outside `_authenticated/dashboard.*` seller flows.

### 2. Header nav parity

Confirm `MarketHeader.tsx` `CATEGORIES` array contains only currently-visible labels. Every entry must resolve via `labelToSlug()` (check `LABEL_ALIAS` for short labels like "Digital Journals").

### 3. Home Browse by Category grid

The `CategoryGrid13.tsx` hidden-slug filter must match `HIDDEN_CATEGORY_SLUGS` in `products.index.tsx` exactly. Diverging lists = user sees a category on home but can't filter to it (or vice versa).

### 4. Products page filter chips + sidebar

Filter chips render from `CATEGORIES = CATEGORY_DEFS.filter(...).map(label)`. Sidebar category checkboxes should read from the same filtered list — check both while editing.

### 5. Deep links still resolve

For each visible category, this URL must load and show that category selected:

```
/products?category=<Label>
```

Legacy slugs in `LEGACY_ALIAS` (e.g. `leadership`, `finance`, `purpose`, `business`) must still map to a visible category — do not delete an alias without confirming no live product rows use it:

```sql
select category, count(*) from products group by category;
```

### 6. Search stays intact

The header search submits `{ q, category: activeCat }`. If `activeCat` refers to a hidden category label, the search returns 0 results. Ensure `activeCat` defaults to `"All"` and hidden labels are unreachable from UI.

### 7. Playwright QA (desktop + mobile)

Run the standard viewport pair — 1280x1800 and 390x1800 — against:

- `/` (home grid)
- `/products` (filter chips + sidebar)
- `/products?category=<one removed label>` (should NOT show that category as selected; chip absent)

Body-text scan for removed labels must return empty on every screen. See `browser-use` in system context for the Playwright skeleton.

### 8. Type + build check

The build is run automatically after edits. Watch for `Type 'X' is not assignable to enum` errors — those signal a slug/enum drift between `categories.ts` and `product-types.ts`.

## Common failure modes

- **Home grid and products filter drift.** Two separate `.filter()` calls means removing a slug from one and not the other. Centralize by importing `HIDDEN_CATEGORY_SLUGS` from `products.index.tsx` (or extract to `categories.ts`) rather than duplicating literals.
- **Header short-label without alias.** Adding "Digital Journals" to the header without a matching `LABEL_ALIAS` entry silently breaks `labelToSlug()`.
- **Removing a slug that has live rows.** Sellers may still have products under the old category. Keep the def in `CATEGORIES` but hide via `HIDDEN_CATEGORY_SLUGS`, or migrate rows first.
- **404 on deep link.** `/products?category=Foo` never 404s — it just filters to nothing. If a user reports 404, the route file is the issue, not the category.

## Publish reminder

Frontend category changes only go live after Publish. Always tell the user: "This needs to be published to go live."
