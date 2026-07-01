CREATE OR REPLACE FUNCTION public.marketplace_products_normalize_title()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.title IS NOT NULL THEN
    -- Trim leading/trailing whitespace and collapse internal whitespace runs to a single space
    NEW.title := btrim(regexp_replace(NEW.title, '\s+', ' ', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_products_normalize_title_trg ON public.marketplace_products;
CREATE TRIGGER marketplace_products_normalize_title_trg
BEFORE INSERT OR UPDATE OF title ON public.marketplace_products
FOR EACH ROW
EXECUTE FUNCTION public.marketplace_products_normalize_title();

-- Backfill existing rows so the unique index reflects normalized values
UPDATE public.marketplace_products
SET title = btrim(regexp_replace(title, '\s+', ' ', 'g'))
WHERE title IS DISTINCT FROM btrim(regexp_replace(title, '\s+', ' ', 'g'));