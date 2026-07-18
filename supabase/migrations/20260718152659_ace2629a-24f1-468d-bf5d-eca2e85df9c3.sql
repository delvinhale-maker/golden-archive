ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS has_interactive_edition boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interactive_edition_file_url text;