
-- 1) Public-safe view of approved storefronts (no PII, no admin notes)
CREATE OR REPLACE VIEW public.public_seller_storefronts
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  id,
  user_id,
  brand_name,
  brand_slug,
  pitch,
  product_types,
  website,
  country,
  social_links,
  categories,
  price_range,
  cover_url,
  extended_bio,
  story,
  credentials,
  featured_media_url,
  created_at
FROM public.seller_applications
WHERE status = 'approved'
  AND brand_slug IS NOT NULL;

GRANT SELECT ON public.public_seller_storefronts TO anon, authenticated;

-- 2) Remove public read of the base table; owner + admin policies remain
DROP POLICY IF EXISTS "Public can view approved storefronts" ON public.seller_applications;
