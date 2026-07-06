
-- Batch 3: Pre-orders, order-bumps, and photo reviews

-- 1. Pre-orders on marketplace_products
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS is_preorder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS release_date timestamptz,
  ADD COLUMN IF NOT EXISTS preorder_note text,
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_marketplace_products_preorder_release
  ON public.marketplace_products (release_date)
  WHERE is_preorder = true AND released_at IS NULL;

-- 2. Pre-order snapshot on order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_preorder_at_purchase boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bump boolean NOT NULL DEFAULT false;

-- 3. Order bumps table
CREATE TABLE IF NOT EXISTS public.product_order_bumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  bump_product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  discount_percent int NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 90),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_order_bumps_no_self CHECK (product_id <> bump_product_id),
  CONSTRAINT product_order_bumps_unique UNIQUE (product_id, bump_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_order_bumps_product
  ON public.product_order_bumps (product_id) WHERE is_active = true;

GRANT SELECT ON public.product_order_bumps TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_order_bumps TO authenticated;
GRANT ALL ON public.product_order_bumps TO service_role;
ALTER TABLE public.product_order_bumps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active bumps"
  ON public.product_order_bumps FOR SELECT
  USING (is_active = true);

CREATE POLICY "Sellers manage own bumps"
  ON public.product_order_bumps FOR ALL
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

CREATE TRIGGER trg_product_order_bumps_touch
  BEFORE UPDATE ON public.product_order_bumps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Review photos table
CREATE TABLE IF NOT EXISTS public.review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  width int,
  height int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_photos_review
  ON public.review_photos (review_id, sort_order);

GRANT SELECT ON public.review_photos TO anon, authenticated;
GRANT INSERT, DELETE ON public.review_photos TO authenticated;
GRANT ALL ON public.review_photos TO service_role;
ALTER TABLE public.review_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read review photos"
  ON public.review_photos FOR SELECT
  USING (true);

CREATE POLICY "Review authors add photos"
  ON public.review_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_reviews r
      WHERE r.id = review_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Review authors delete own photos"
  ON public.review_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.product_reviews r
      WHERE r.id = review_id AND r.user_id = auth.uid()
    )
  );
