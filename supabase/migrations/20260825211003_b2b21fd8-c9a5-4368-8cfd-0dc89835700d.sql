-- Lock down paid delivery path exposure while preserving public product catalog reads.

-- marketplace_products: remove public-role policy and recreate it only for anonymous catalog reads.
-- Column grants below keep public reads to display-safe fields and exclude delivery paths.
DROP POLICY IF EXISTS "products_public_published_read" ON public.marketplace_products;

REVOKE SELECT ON public.marketplace_products FROM PUBLIC;
REVOKE SELECT ON public.marketplace_products FROM anon;
REVOKE SELECT (file_path, file_size_bytes, interactive_edition_file_url, admin_notes, rejected_reason, platform_fee_pct,
  ai_review_issues, ai_reviewed_at)
  ON public.marketplace_products FROM anon;

GRANT SELECT (
  id, seller_id, title, subtitle, description, category, subcategory, language,
  price_cents, compare_at_price_cents, cover_url, creator_name, status, published,
  featured, slug, created_at, updated_at, approved_at, ai_review_status,
  ai_review_score, ai_review_blurb, ai_review_seo_title, ai_review_tags,
  is_preorder, release_date, released_at, preorder_note, preview_pages,
  has_interactive_edition, product_type, delivery_contents
) ON public.marketplace_products TO anon;

CREATE POLICY "products_public_published_read"
  ON public.marketplace_products
  FOR SELECT
  TO anon
  USING (status = 'approved'::product_status AND published = true);

-- product_download_files: never expose delivery manifests or storage paths publicly.
DROP POLICY IF EXISTS "Anyone can view delivery files of live products" ON public.product_download_files;

REVOKE SELECT ON public.product_download_files FROM PUBLIC;
REVOKE SELECT ON public.product_download_files FROM anon;
REVOKE SELECT (file_path, label, file_size_bytes, format, product_id, seller_id, is_primary, sort_order)
  ON public.product_download_files FROM anon;

-- Authenticated table access remains RLS-scoped to sellers/admins by existing policies.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_download_files TO authenticated;
GRANT ALL ON public.product_download_files TO service_role;

-- product_variants warning-adjacent hardening: keep public variant display reads column-scoped.
REVOKE SELECT ON public.product_variants FROM PUBLIC;
REVOKE SELECT ON public.product_variants FROM anon;
REVOKE SELECT (file_path) ON public.product_variants FROM anon;
GRANT SELECT (
  id, product_id, name, description, license_type, price_cents, pay_what_you_want,
  min_price_cents, file_size_bytes, sort_order, is_active, created_at, updated_at
) ON public.product_variants TO anon;

DROP POLICY IF EXISTS "Public can view active variants of published products" ON public.product_variants;
CREATE POLICY "Public can view active variants of published products"
  ON public.product_variants
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.marketplace_products p
      WHERE p.id = product_variants.product_id
        AND p.published = true
        AND p.status = 'approved'::product_status
    )
  );