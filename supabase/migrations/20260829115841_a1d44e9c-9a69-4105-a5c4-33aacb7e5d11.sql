ALTER TABLE public.marketplace_products ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_products_slug_key ON public.marketplace_products (slug) WHERE slug IS NOT NULL;
UPDATE public.marketplace_products SET slug = 'dethroning-the-bully-2' WHERE id = 'cd508ae9-5521-4fac-85be-266f899cb6fc' AND (slug IS NULL OR slug <> 'dethroning-the-bully-2');