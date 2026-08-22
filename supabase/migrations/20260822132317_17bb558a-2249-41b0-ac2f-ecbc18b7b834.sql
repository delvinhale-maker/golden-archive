-- 1) Bundles
CREATE TABLE public.marketplace_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_seller_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  full_description text,
  image_url text,
  status text NOT NULL DEFAULT 'draft',
  price_cents integer NOT NULL CHECK (price_cents > 0),
  featured boolean NOT NULL DEFAULT false,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_bundles_status_chk CHECK (status IN ('draft','active','archived'))
);
GRANT SELECT ON public.marketplace_bundles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_bundles TO authenticated;
GRANT ALL ON public.marketplace_bundles TO service_role;
ALTER TABLE public.marketplace_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bundles_public_read_active" ON public.marketplace_bundles
FOR SELECT USING (
  status = 'active'
  AND (start_at IS NULL OR start_at <= now())
  AND (end_at IS NULL OR end_at > now())
);
CREATE POLICY "bundles_admin_read" ON public.marketplace_bundles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "bundles_admin_write" ON public.marketplace_bundles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER marketplace_bundles_touch
BEFORE UPDATE ON public.marketplace_bundles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Bundle items
CREATE TABLE public.marketplace_bundle_items (
  bundle_id uuid NOT NULL REFERENCES public.marketplace_bundles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT true,
  PRIMARY KEY (bundle_id, product_id)
);
GRANT SELECT ON public.marketplace_bundle_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_bundle_items TO authenticated;
GRANT ALL ON public.marketplace_bundle_items TO service_role;
ALTER TABLE public.marketplace_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bundle_items_public_read" ON public.marketplace_bundle_items
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.marketplace_bundles b
  WHERE b.id = bundle_id
    AND b.status = 'active'
    AND (b.start_at IS NULL OR b.start_at <= now())
    AND (b.end_at IS NULL OR b.end_at > now())
));
CREATE POLICY "bundle_items_admin_read" ON public.marketplace_bundle_items
FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "bundle_items_admin_write" ON public.marketplace_bundle_items
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3) Curated recommendations
CREATE TABLE public.product_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  recommended_product_id uuid REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  recommended_bundle_id uuid REFERENCES public.marketplace_bundles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'toolkit',
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_recommendations_kind_chk CHECK (kind IN ('toolkit','pairs_with','also_need','continue')),
  CONSTRAINT product_recommendations_target_chk CHECK (
    (recommended_product_id IS NOT NULL AND recommended_bundle_id IS NULL)
    OR (recommended_product_id IS NULL AND recommended_bundle_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX product_recommendations_unique_product
  ON public.product_recommendations (product_id, kind, recommended_product_id)
  WHERE recommended_product_id IS NOT NULL;
CREATE UNIQUE INDEX product_recommendations_unique_bundle
  ON public.product_recommendations (product_id, kind, recommended_bundle_id)
  WHERE recommended_bundle_id IS NOT NULL;
GRANT SELECT ON public.product_recommendations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_recommendations TO authenticated;
GRANT ALL ON public.product_recommendations TO service_role;
ALTER TABLE public.product_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_recs_public_read" ON public.product_recommendations
FOR SELECT USING (active = true);
CREATE POLICY "product_recs_admin_write" ON public.product_recommendations
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4) Merchandising analytics events
CREATE TABLE public.merch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  surface text NOT NULL,
  bundle_id uuid REFERENCES public.marketplace_bundles(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.marketplace_products(id) ON DELETE SET NULL,
  order_id uuid,
  session_id text,
  offer_version text,
  amount_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merch_events_kind_chk CHECK (kind IN ('impression','click','add_to_cart','upgrade','purchase'))
);
CREATE INDEX merch_events_created_idx ON public.merch_events (created_at DESC);
CREATE INDEX merch_events_bundle_idx ON public.merch_events (bundle_id, kind);
GRANT INSERT ON public.merch_events TO anon;
GRANT INSERT, SELECT ON public.merch_events TO authenticated;
GRANT ALL ON public.merch_events TO service_role;
ALTER TABLE public.merch_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merch_events_insert_any" ON public.merch_events
FOR INSERT WITH CHECK (true);
CREATE POLICY "merch_events_admin_read" ON public.merch_events
FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 5) Bundle attribution on order lines
ALTER TABLE public.order_items
  ADD COLUMN bundle_id uuid REFERENCES public.marketplace_bundles(id) ON DELETE SET NULL,
  ADD COLUMN bundle_name text;
CREATE INDEX order_items_bundle_idx ON public.order_items (bundle_id);