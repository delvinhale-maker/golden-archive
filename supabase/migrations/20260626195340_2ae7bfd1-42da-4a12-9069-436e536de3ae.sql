
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'purpose';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'business';

ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;
