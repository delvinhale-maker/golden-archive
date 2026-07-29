ALTER TABLE public.marketplace_products ADD COLUMN IF NOT EXISTS subcategory text;
GRANT SELECT (subcategory) ON public.marketplace_products TO anon;