
-- Add slug column for stable product identity
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS slug text;

-- Backfill slug from normalized title per seller
CREATE OR REPLACE FUNCTION public.marketplace_products_slugify(_title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_title,'')), '[^a-z0-9]+', '-', 'g'));
$$;

UPDATE public.marketplace_products
   SET slug = public.marketplace_products_slugify(title)
 WHERE slug IS NULL OR slug = '';

-- Trigger to auto-populate slug on insert/update if missing
CREATE OR REPLACE FUNCTION public.marketplace_products_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR length(trim(NEW.slug)) = 0 THEN
    NEW.slug := public.marketplace_products_slugify(NEW.title);
  ELSE
    NEW.slug := public.marketplace_products_slugify(NEW.slug);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketplace_products_set_slug ON public.marketplace_products;
CREATE TRIGGER trg_marketplace_products_set_slug
BEFORE INSERT OR UPDATE OF title, slug ON public.marketplace_products
FOR EACH ROW EXECUTE FUNCTION public.marketplace_products_set_slug();

ALTER TABLE public.marketplace_products
  ALTER COLUMN slug SET NOT NULL;

-- Prevent two products from the same seller having the same slug
-- (covers duplicate titles like "Scrolling Smart" submitted twice).
-- Excludes rejected listings so a rejected duplicate doesn't block a relisting.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_products_seller_slug_unique
  ON public.marketplace_products (seller_id, slug)
  WHERE status <> 'rejected';
