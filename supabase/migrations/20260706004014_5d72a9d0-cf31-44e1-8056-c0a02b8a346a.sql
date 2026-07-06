-- License type enum
DO $$ BEGIN
  CREATE TYPE public.product_license_type AS ENUM ('personal', 'commercial', 'extended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Variants table
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  license_type public.product_license_type,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  pay_what_you_want boolean NOT NULL DEFAULT false,
  min_price_cents integer CHECK (min_price_cents IS NULL OR min_price_cents >= 0),
  file_path text,
  file_size_bytes bigint,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_variants_product_idx ON public.product_variants(product_id, sort_order);

GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Public read of active variants on published+approved products
CREATE POLICY "Public can view active variants of published products"
  ON public.product_variants FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.marketplace_products p
      WHERE p.id = product_variants.product_id
        AND p.published = true
        AND p.status = 'approved'
    )
  );

-- Creator manages own product's variants
CREATE POLICY "Creators can view own product variants"
  ON public.product_variants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketplace_products p WHERE p.id = product_variants.product_id AND p.seller_id = auth.uid()));

CREATE POLICY "Creators can insert own product variants"
  ON public.product_variants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketplace_products p WHERE p.id = product_variants.product_id AND p.seller_id = auth.uid()));

CREATE POLICY "Creators can update own product variants"
  ON public.product_variants FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketplace_products p WHERE p.id = product_variants.product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketplace_products p WHERE p.id = product_variants.product_id AND p.seller_id = auth.uid()));

CREATE POLICY "Creators can delete own product variants"
  ON public.product_variants FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketplace_products p WHERE p.id = product_variants.product_id AND p.seller_id = auth.uid()));

-- Admin
CREATE POLICY "Admins can view all variants"
  ON public.product_variants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all variants"
  ON public.product_variants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER product_variants_touch_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Extend order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_name text,
  ADD COLUMN IF NOT EXISTS variant_license_type public.product_license_type;

CREATE INDEX IF NOT EXISTS order_items_variant_idx ON public.order_items(variant_id);