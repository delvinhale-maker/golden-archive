-- Ensure anon has NO table-wide SELECT (column-level grants only)
REVOKE SELECT ON public.marketplace_products FROM anon;
REVOKE SELECT ON public.product_variants FROM anon;

-- Explicitly remove any column-level SELECT on internal columns for anon
REVOKE SELECT (file_path, file_size_bytes, admin_notes, rejected_reason, platform_fee_pct,
  ai_review_status, ai_review_score, ai_review_issues, ai_review_blurb,
  ai_review_seo_title, ai_review_tags, ai_reviewed_at, interactive_edition_file_url)
  ON public.marketplace_products FROM anon;

REVOKE SELECT (file_path) ON public.product_variants FROM anon;

-- Grant only the public, customer-facing columns to anon
GRANT SELECT (
  id, seller_id, title, subtitle, description, category, subcategory, language,
  price_cents, compare_at_price_cents, cover_url, status, published, featured, slug,
  created_at, updated_at, approved_at, is_preorder, release_date, released_at,
  preorder_note, preview_pages, has_interactive_edition
) ON public.marketplace_products TO anon;

GRANT SELECT (
  id, product_id, name, description, license_type, price_cents, pay_what_you_want,
  min_price_cents, file_size_bytes, sort_order, is_active, created_at, updated_at
) ON public.product_variants TO anon;

GRANT ALL ON public.marketplace_products TO service_role;
GRANT ALL ON public.product_variants TO service_role;