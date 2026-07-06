
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS preview_pages integer[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.validate_preview_pages()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.preview_pages IS NULL THEN
    NEW.preview_pages := '{}';
  END IF;
  IF array_length(NEW.preview_pages, 1) > 5 THEN
    RAISE EXCEPTION 'preview_pages: max 5 pages';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW.preview_pages) p WHERE p < 1) THEN
    RAISE EXCEPTION 'preview_pages: page numbers must be >= 1';
  END IF;
  IF (SELECT count(*) <> count(DISTINCT p) FROM unnest(NEW.preview_pages) p) THEN
    RAISE EXCEPTION 'preview_pages: pages must be unique';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_preview_pages_trg ON public.marketplace_products;
CREATE TRIGGER validate_preview_pages_trg
  BEFORE INSERT OR UPDATE OF preview_pages ON public.marketplace_products
  FOR EACH ROW EXECUTE FUNCTION public.validate_preview_pages();
