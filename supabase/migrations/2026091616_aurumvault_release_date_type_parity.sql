ALTER TABLE public.marketplace_products
  ALTER COLUMN release_date TYPE timestamptz
  USING release_date::timestamptz;
