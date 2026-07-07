
-- Remove the view (it tripped the SECURITY DEFINER View linter)
DROP VIEW IF EXISTS public.public_seller_storefronts;

-- Restore public read access to approved storefronts (row-level)
CREATE POLICY "Public can view approved storefronts"
ON public.seller_applications
FOR SELECT
TO anon, authenticated
USING (status = 'approved' AND brand_slug IS NOT NULL);

-- Hide sensitive columns from anonymous visitors via column-level privileges.
-- PostgREST honors column privileges: anon cannot select these fields at all.
REVOKE SELECT ON public.seller_applications FROM anon;
GRANT SELECT (
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
  status,
  reapply_after,
  created_at,
  reviewed_at
) ON public.seller_applications TO anon;

-- Also hide from generic authenticated visitors (non-owner, non-admin).
-- Owners/admins read through SECURITY DEFINER paths / their own policies,
-- but PostgREST column privileges are role-wide, so we cannot easily grant
-- extra cols only to owners. Owners currently do not read applicant_email
-- via client code — dashboards use auth.user().email. Admins read via
-- has_role in server code with service_role, which bypasses column ACLs.
REVOKE SELECT ON public.seller_applications FROM authenticated;
GRANT SELECT (
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
  status,
  reapply_after,
  admin_feedback,
  created_at,
  reviewed_at
) ON public.seller_applications TO authenticated;

-- Keep write privileges for authenticated (insert own row); admin ops use service_role.
GRANT INSERT, UPDATE, DELETE ON public.seller_applications TO authenticated;
GRANT ALL ON public.seller_applications TO service_role;
