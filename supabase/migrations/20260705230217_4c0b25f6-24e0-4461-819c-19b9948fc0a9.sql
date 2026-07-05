ALTER TABLE public.seller_applications
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS social_links jsonb,
  ADD COLUMN IF NOT EXISTS categories text[],
  ADD COLUMN IF NOT EXISTS price_range text;