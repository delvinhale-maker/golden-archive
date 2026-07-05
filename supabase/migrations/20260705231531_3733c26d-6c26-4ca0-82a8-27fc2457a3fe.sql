
-- Revoke broad table-level SELECT from anon (given by previous migration)
REVOKE SELECT ON public.seller_applications FROM anon;

-- Grant column-level SELECT to anon for storefront-safe columns only
GRANT SELECT
  (id, user_id, brand_name, brand_slug, pitch, country, website, categories, social_links, created_at)
  ON public.seller_applications
  TO anon;
