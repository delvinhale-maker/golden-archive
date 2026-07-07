
-- 1. product_previews table
CREATE TABLE public.product_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  page_order int NOT NULL DEFAULT 1,
  image_url text NOT NULL,
  alt_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_previews_product_order_unique
  ON public.product_previews (product_id, page_order);
CREATE INDEX product_previews_product_idx
  ON public.product_previews (product_id);

-- 2. Grants (public read via anon; creators/admins manage via authenticated)
GRANT SELECT ON public.product_previews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_previews TO authenticated;
GRANT ALL ON public.product_previews TO service_role;

-- 3. RLS
ALTER TABLE public.product_previews ENABLE ROW LEVEL SECURITY;

-- Public can read preview rows for published, approved products.
CREATE POLICY "Public can view previews of published products"
  ON public.product_previews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_products p
      WHERE p.id = product_previews.product_id
        AND p.published = true
        AND p.status = 'approved'
    )
  );

-- Product owner can read all their preview rows (even for unpublished drafts).
CREATE POLICY "Owners can view their product previews"
  ON public.product_previews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_products p
      WHERE p.id = product_previews.product_id
        AND p.seller_id = auth.uid()
    )
  );

-- Product owner can insert/update/delete their preview rows.
CREATE POLICY "Owners can insert their product previews"
  ON public.product_previews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marketplace_products p
      WHERE p.id = product_previews.product_id
        AND p.seller_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update their product previews"
  ON public.product_previews FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_products p
      WHERE p.id = product_previews.product_id
        AND p.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marketplace_products p
      WHERE p.id = product_previews.product_id
        AND p.seller_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete their product previews"
  ON public.product_previews FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_products p
      WHERE p.id = product_previews.product_id
        AND p.seller_id = auth.uid()
    )
  );

-- Admins can do anything.
CREATE POLICY "Admins can manage all previews"
  ON public.product_previews FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. updated_at trigger (reuse existing helper)
CREATE TRIGGER product_previews_touch_updated_at
  BEFORE UPDATE ON public.product_previews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Storage policies for the public product-previews bucket
CREATE POLICY "Public can read product preview images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-previews');

CREATE POLICY "Authenticated users can upload product preview images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-previews');

CREATE POLICY "Authenticated users can update product preview images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-previews')
  WITH CHECK (bucket_id = 'product-previews');

CREATE POLICY "Authenticated users can delete product preview images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-previews');
