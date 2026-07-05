
-- Add new status values for creator applications workflow
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'info_requested';

-- Add fields to support storefront + admin feedback + reapply flow
ALTER TABLE public.seller_applications
  ADD COLUMN IF NOT EXISTS brand_slug text,
  ADD COLUMN IF NOT EXISTS admin_feedback text,
  ADD COLUMN IF NOT EXISTS reapply_after date;

-- Unique brand_slug index (partial: only when set)
CREATE UNIQUE INDEX IF NOT EXISTS seller_applications_brand_slug_key
  ON public.seller_applications (brand_slug)
  WHERE brand_slug IS NOT NULL;

-- Slugify helper reused for brands
CREATE OR REPLACE FUNCTION public.brand_slugify(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_name,'')), '[^a-z0-9]+', '-', 'g'));
$$;

-- Allow anon to read approved applications' public storefront fields
DROP POLICY IF EXISTS "Public can view approved storefronts" ON public.seller_applications;
CREATE POLICY "Public can view approved storefronts"
  ON public.seller_applications
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved' AND brand_slug IS NOT NULL);

GRANT SELECT ON public.seller_applications TO anon;
