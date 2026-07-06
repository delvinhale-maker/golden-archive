
ALTER TABLE public.affiliate_products
  ADD COLUMN IF NOT EXISTS deal_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deal_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS affiliate_products_deal_idx
  ON public.affiliate_products (deal_active, deal_expires_at DESC)
  WHERE deal_active = true;
