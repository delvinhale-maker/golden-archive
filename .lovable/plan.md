# AurumVault Taxonomy + Bundle Delivery Upgrade

## What the audit found

- Products live in one table with `category` (enum) + `subcategory` (text). There is **no** product-type column — product type is currently *derived* from category, which is exactly the label collision the brief describes ("Business System" is both a category and a type).
- Category definitions, nav chips and subcategory lists already have a single source of truth (`src/lib/categories.ts`) plus an admin-managed subcategory table. Business Systems and Creator Business Tools each have their own merchandising layer that reuses those slugs — no parallel taxonomy to remove.
- Multi-file delivery already exists (manifest table, creator uploader, product page "Your download includes", library per-file downloads with short-lived signed URLs). It needs a designated **primary bundle** and a "Delivery Contents" descriptor, not a rebuild.
- Filters on /products currently offer Price, Category, Rating — no product-type facet.

So this is additive work on top of what exists, in three phases.

## Phase 1 — Taxonomy foundation (build first)

1. Additive migration on products: `product_type` (text), `delivery_contents` (text[]), `primary_bundle_file_id` (uuid → delivery files). No column removals, no enum renames, existing URLs and assignments untouched.
2. Backfill `product_type` from existing category/subcategory using the legacy map (e.g. legacy Business System → **Complete Digital System**; eBooks → eBook; planners/journals → Planner / Journal; prompt packs → Prompt System; film/TV → Creator Production System). Products with no mapping keep working via runtime fallback, so nothing disappears from filters.
3. New single source of truth `src/lib/taxonomy.ts`: the 11 official Product Types (with picker card copy), the Delivery Contents options, and the Category → Subcategory/System Type mapping — consumed by seller flow, filters, cards, product pages, search and library. No new hard-coded lists in components.
4. Business Systems system types normalised to: All, Interactive Decision Tools, Complete Business Systems, Live Dashboards & Calculators, Operating Systems, Assessment & Scoring Tools — added to the admin subcategory table, existing names preserved as aliases so live products keep showing.
5. Creator Business Tools gains Rights & Licensing and Creator Operations; its chip row stays business-function only (no product-type terms mixed in).

## Phase 2 — Surfaces

- **Seller/admin flow:** three labelled fields — Category ("Where should shoppers find this product?"), Subcategory/System Type (label switches to "System Type" for Business Systems), Product Type ("How does the customer use or experience this product?") — plus a Delivery Contents multi-select and a "Primary Customer Bundle" designation in the file manager. Selections persist through save → edit → reopen.
- **Filters:** Category → Product Type → Price → Rating, collapsible, 44px targets, no mobile overflow.
- **Product page:** max 2 badges + one metadata line (file count, formats), structured "Included with your purchase" from the file manifest, and "Get the Complete System" CTA only for Complete Digital System products (eBooks/journals keep existing copy).
- **Cards:** one subtle product-type line, no badge pile-up.
- **Post-purchase/library:** primary "Download Complete Bundle" CTA (never "Download ZIP"), individual files listed beneath. Existing download authorization and signed-URL protections stay exactly as-is.
- **Search:** extend to title, category, subcategory/system type, product type and keywords.

## Phase 3 — Reference products + QA

- Configure Creator Performance & ROI Operating System™ and Digital Product Opportunity & Validation System™ per the spec (category / system type / product type / badges / delivery contents / CTA).
- QA pass: taxonomy filter combinations, seller create → edit → reopen persistence, product page metadata, download authorization, legacy eBooks/journals/planners/prompt packs still display and download, and mobile at 360 / 390 / 430 / 768px.
- Final report split into Implemented / Verified / Not Yet Verified / Blocked.

## Notes

- No "ZIP Files" or "Downloads" category is created; ZIP stays a delivery format only.
- Interactive Decision Tools stays a system type inside Business Systems, never a top-level category.
- Navy / ivory / restrained gold visual language and existing components are reused throughout.
- Each phase needs Publish to go live.
