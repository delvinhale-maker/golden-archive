# Batch 2 — Shared Product Variants System

One system powers three features: multi-tier products (Basic/Pro/Premium), license types (Personal/Commercial/Extended), and Pay What You Want. A variant is a purchasable option on a product with its own name, price, files, and optional license label.

## What you'll see as a user

**Creator (publish/edit product):**
- New "Variants" section on the product editor
- Add rows: name, price, optional license label, optional file(s), short description
- Toggle "Pay What You Want" on any variant → set a minimum floor; buyer names the price above it
- If no variants are added, the product behaves exactly like today (single price + single file)

**Buyer (product page):**
- If the product has variants, radio-style tier picker replaces the single price line
- Selected tier shows its price, license label, features, and what's included
- For PWYW variants, an input appears: "Name your price (min $X.XX)"
- Add-to-cart / buy uses the selected variant

**Download page:**
- Buyer receives files for the specific variant they purchased
- License label shown on the download confirmation

## Database

New table `product_variants`:
- `product_id` (fk → marketplace_products)
- `name` (e.g. "Pro", "Commercial License")
- `description` (short bullets/features text)
- `license_type` (nullable enum: `personal` | `commercial` | `extended`)
- `price_cents` (min charge / floor when PWYW)
- `pay_what_you_want` (bool, default false)
- `file_path`, `file_size_bytes` (nullable — fall back to product's file if null)
- `sort_order` (int)
- `is_active` (bool)

Extend `order_items`:
- `variant_id` (nullable fk) — null = legacy purchase of base product
- `variant_name`, `variant_license_type` snapshotted at purchase

RLS: creators manage own variants; anon/auth can read variants of published products; service_role full. GRANTs per convention.

## Checkout wiring

- Cart entries carry `variantId` and (for PWYW) the `buyerPrice`
- Checkout server fn validates: variant belongs to product, price ≥ floor, variant active
- `order_items` records `variant_id`, snapshotted name/license, actual `unit_price_cents`
- Affiliate commissions (batch 1) use the actual sale amount → already correct
- Download resolver returns the variant's file when set, else the product's base file

## New/edited files

- Migration: `product_variants` table + `order_items` columns + RLS + GRANTs
- `src/lib/product-variants.functions.ts` — CRUD for creators
- Product editor (existing publish/edit route): new "Variants" panel component
- Product page: `<VariantPicker>` component, PWYW input
- Cart store: extend line-item shape with variantId + buyerPrice
- Checkout server fn: variant validation + snapshotting
- Download resolver: variant-aware file lookup

## Not in this batch

- Bundles (already have `creator_bundles`)
- Pre-orders, order-bumps, photo reviews → Batch 3

Reply "go" to build it, or tell me what to adjust.