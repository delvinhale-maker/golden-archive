CREATE TABLE IF NOT EXISTS public.marketplace_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_seller_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  full_description text,
  image_url text,
  status text NOT NULL DEFAULT 'draft' CONSTRAINT marketplace_bundles_status_chk CHECK (status IN ('draft','active','archived')),
  price_cents integer NOT NULL CONSTRAINT marketplace_bundles_price_cents_check CHECK (price_cents > 0),
  featured boolean NOT NULL DEFAULT false,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_bundle_items (
  bundle_id uuid NOT NULL REFERENCES public.marketplace_bundles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT true,
  PRIMARY KEY (bundle_id,product_id)
);

CREATE TABLE IF NOT EXISTS public.merch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CONSTRAINT merch_events_kind_chk CHECK (kind IN ('impression','click','add_to_cart','upgrade','purchase')),
  surface text NOT NULL,
  bundle_id uuid REFERENCES public.marketplace_bundles(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.marketplace_products(id) ON DELETE SET NULL,
  order_id uuid,
  session_id text,
  offer_version text,
  amount_cents integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CONSTRAINT payout_requests_amount_cents_check CHECK (amount_cents >= 2500),
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending' CONSTRAINT payout_requests_status_check CHECK (status IN ('pending','approved','rejected','paid')),
  method_snapshot jsonb,
  seller_note text,
  admin_note text,
  seller_payout_id uuid REFERENCES public.seller_payouts(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_download_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  label text NOT NULL,
  file_path text NOT NULL,
  file_size_bytes bigint,
  format text,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_order_bumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  bump_product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  discount_percent integer NOT NULL DEFAULT 0 CONSTRAINT product_order_bumps_discount_percent_check CHECK (discount_percent BETWEEN 0 AND 90),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_order_bumps_no_self CHECK (product_id <> bump_product_id),
  CONSTRAINT product_order_bumps_unique UNIQUE (product_id,bump_product_id)
);

CREATE TABLE IF NOT EXISTS public.product_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  page_order integer NOT NULL DEFAULT 1,
  image_url text NOT NULL,
  alt_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_publish_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  event text NOT NULL,
  from_published boolean,
  to_published boolean,
  from_status text,
  to_status text,
  actor_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  recommended_product_id uuid REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  recommended_bundle_id uuid REFERENCES public.marketplace_bundles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'toolkit' CONSTRAINT product_recommendations_kind_chk CHECK (kind IN ('toolkit','pairs_with','also_need','continue')),
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_recommendations_target_chk CHECK (((recommended_product_id IS NOT NULL) AND (recommended_bundle_id IS NULL)) OR ((recommended_product_id IS NULL) AND (recommended_bundle_id IS NOT NULL)))
);

CREATE TABLE IF NOT EXISTS public.product_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug text NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_slug,name)
);

CREATE TABLE IF NOT EXISTS public.review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.slug_integrity_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  missing_slug_count integer NOT NULL DEFAULT 0,
  duplicate_group_count integer NOT NULL DEFAULT 0,
  index_present boolean NOT NULL DEFAULT true,
  details jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.vault_finds_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL,
  subtext text NOT NULL,
  image_url text,
  affiliate_link text NOT NULL,
  accent_color text NOT NULL DEFAULT 'emerald' CONSTRAINT vault_finds_products_accent_color_check CHECK (accent_color IN ('emerald','burgundy','amber','dusty','cream')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merch_events_bundle_idx ON public.merch_events(bundle_id,kind);
CREATE INDEX IF NOT EXISTS merch_events_created_idx ON public.merch_events(created_at DESC);
CREATE INDEX IF NOT EXISTS payout_requests_seller_idx ON public.payout_requests(seller_id,created_at DESC);
CREATE INDEX IF NOT EXISTS payout_requests_status_idx ON public.payout_requests(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdf_product ON public.product_download_files(product_id,sort_order);
CREATE INDEX IF NOT EXISTS idx_product_order_bumps_product ON public.product_order_bumps(product_id) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS product_previews_product_idx ON public.product_previews(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_previews_product_order_unique ON public.product_previews(product_id,page_order);
CREATE INDEX IF NOT EXISTS idx_pph_product_created ON public.product_publish_history(product_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS product_recommendations_unique_bundle ON public.product_recommendations(product_id,kind,recommended_bundle_id) WHERE recommended_bundle_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_recommendations_unique_product ON public.product_recommendations(product_id,kind,recommended_product_id) WHERE recommended_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_photos_review ON public.review_photos(review_id,sort_order);

DROP TRIGGER IF EXISTS marketplace_bundles_touch ON public.marketplace_bundles;
CREATE TRIGGER marketplace_bundles_touch BEFORE UPDATE ON public.marketplace_bundles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS payout_requests_touch ON public.payout_requests;
CREATE TRIGGER payout_requests_touch BEFORE UPDATE ON public.payout_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_pdf_updated_at ON public.product_download_files;
CREATE TRIGGER trg_pdf_updated_at BEFORE UPDATE ON public.product_download_files FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_product_order_bumps_touch ON public.product_order_bumps;
CREATE TRIGGER trg_product_order_bumps_touch BEFORE UPDATE ON public.product_order_bumps FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS product_previews_touch_updated_at ON public.product_previews;
CREATE TRIGGER product_previews_touch_updated_at BEFORE UPDATE ON public.product_previews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS product_subcategories_touch_updated_at ON public.product_subcategories;
CREATE TRIGGER product_subcategories_touch_updated_at BEFORE UPDATE ON public.product_subcategories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS vault_finds_products_touch_updated_at ON public.vault_finds_products;
CREATE TRIGGER vault_finds_products_touch_updated_at BEFORE UPDATE ON public.vault_finds_products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.marketplace_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_download_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_order_bumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_publish_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slug_integrity_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_finds_products ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.marketplace_bundles,public.marketplace_bundle_items,public.merch_events,public.payout_requests,public.product_download_files,public.product_order_bumps,public.product_previews,public.product_publish_history,public.product_recommendations,public.product_subcategories,public.review_photos,public.slug_integrity_alerts,public.vault_finds_products FROM anon,authenticated;
GRANT ALL ON public.marketplace_bundles,public.marketplace_bundle_items,public.merch_events,public.payout_requests,public.product_download_files,public.product_order_bumps,public.product_previews,public.product_publish_history,public.product_recommendations,public.product_subcategories,public.review_photos,public.slug_integrity_alerts,public.vault_finds_products TO service_role;
GRANT SELECT ON public.marketplace_bundles,public.marketplace_bundle_items,public.product_order_bumps,public.product_previews,public.product_recommendations,public.product_subcategories,public.review_photos,public.vault_finds_products TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.marketplace_bundles,public.marketplace_bundle_items,public.product_recommendations,public.product_subcategories,public.vault_finds_products TO authenticated;
GRANT INSERT ON public.merch_events TO anon,authenticated;
GRANT SELECT ON public.merch_events TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.payout_requests TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.product_download_files,public.product_order_bumps,public.product_previews TO authenticated;
GRANT SELECT ON public.product_publish_history,public.slug_integrity_alerts TO authenticated;
GRANT INSERT,DELETE ON public.review_photos TO authenticated;

CREATE POLICY bundles_admin_read ON public.marketplace_bundles FOR SELECT TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY bundles_admin_write ON public.marketplace_bundles FOR ALL TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY bundles_public_read_active ON public.marketplace_bundles FOR SELECT TO anon,authenticated USING (status='active' AND (start_at IS NULL OR start_at<=now()) AND (end_at IS NULL OR end_at>now()));
CREATE POLICY bundle_items_admin_read ON public.marketplace_bundle_items FOR SELECT TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY bundle_items_admin_write ON public.marketplace_bundle_items FOR ALL TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY bundle_items_public_read ON public.marketplace_bundle_items FOR SELECT TO anon,authenticated USING (EXISTS (SELECT 1 FROM public.marketplace_bundles b WHERE b.id=marketplace_bundle_items.bundle_id AND b.status='active' AND (b.start_at IS NULL OR b.start_at<=now()) AND (b.end_at IS NULL OR b.end_at>now())));
CREATE POLICY merch_events_admin_read ON public.merch_events FOR SELECT TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY merch_events_insert_any ON public.merch_events FOR INSERT TO anon,authenticated WITH CHECK (true);
CREATE POLICY "Admins update requests" ON public.payout_requests FOR UPDATE TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Sellers insert own request" ON public.payout_requests FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=seller_id);
CREATE POLICY "View own or admin" ON public.payout_requests FOR SELECT TO authenticated USING ((select auth.uid())=seller_id OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Sellers can add delivery files to their products" ON public.product_download_files FOR INSERT TO authenticated WITH CHECK (((seller_id=(select auth.uid())) AND EXISTS (SELECT 1 FROM public.marketplace_products p WHERE p.id=product_download_files.product_id AND p.seller_id=(select auth.uid()))) OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Sellers can delete their delivery files" ON public.product_download_files FOR DELETE TO authenticated USING (seller_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Sellers can update their delivery files" ON public.product_download_files FOR UPDATE TO authenticated USING (seller_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (seller_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Sellers can view their own delivery files" ON public.product_download_files FOR SELECT TO authenticated USING (seller_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Anyone can read active bumps" ON public.product_order_bumps FOR SELECT TO anon,authenticated USING (is_active=true);
CREATE POLICY "Sellers manage own bumps" ON public.product_order_bumps FOR ALL TO authenticated USING (seller_id=(select auth.uid())) WITH CHECK (seller_id=(select auth.uid()));
CREATE POLICY "Admins can manage all previews" ON public.product_previews FOR ALL TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Owners can delete their product previews" ON public.product_previews FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.marketplace_products p WHERE p.id=product_previews.product_id AND p.seller_id=(select auth.uid())));
CREATE POLICY "Owners can insert their product previews" ON public.product_previews FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.marketplace_products p WHERE p.id=product_previews.product_id AND p.seller_id=(select auth.uid())));
CREATE POLICY "Owners can update their product previews" ON public.product_previews FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.marketplace_products p WHERE p.id=product_previews.product_id AND p.seller_id=(select auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.marketplace_products p WHERE p.id=product_previews.product_id AND p.seller_id=(select auth.uid())));
CREATE POLICY "Owners can view their product previews" ON public.product_previews FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.marketplace_products p WHERE p.id=product_previews.product_id AND p.seller_id=(select auth.uid())));
CREATE POLICY "Public can view previews of published products" ON public.product_previews FOR SELECT TO anon,authenticated USING (EXISTS (SELECT 1 FROM public.marketplace_products p WHERE p.id=product_previews.product_id AND p.published=true AND p.status='approved'::public.product_status));
CREATE POLICY "Sellers view own product history" ON public.product_publish_history FOR SELECT TO authenticated USING (seller_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY product_recs_admin_write ON public.product_recommendations FOR ALL TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY product_recs_public_read ON public.product_recommendations FOR SELECT TO anon,authenticated USING (active=true);
CREATE POLICY "Admins can delete subcategories" ON public.product_subcategories FOR DELETE TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Admins can insert subcategories" ON public.product_subcategories FOR INSERT TO authenticated WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Admins can update subcategories" ON public.product_subcategories FOR UPDATE TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Subcategories are viewable by everyone" ON public.product_subcategories FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Anyone can read review photos" ON public.review_photos FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Review authors add photos" ON public.review_photos FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.product_reviews r WHERE r.id=review_photos.review_id AND r.user_id=(select auth.uid())));
CREATE POLICY "Review authors delete own photos" ON public.review_photos FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.product_reviews r WHERE r.id=review_photos.review_id AND r.user_id=(select auth.uid())));
CREATE POLICY "Admins read slug alerts" ON public.slug_integrity_alerts FOR SELECT TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Admins can delete vault finds" ON public.vault_finds_products FOR DELETE TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Admins can insert vault finds" ON public.vault_finds_products FOR INSERT TO authenticated WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Admins can read all vault finds" ON public.vault_finds_products FOR SELECT TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Admins can update vault finds" ON public.vault_finds_products FOR UPDATE TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Public can read active vault finds" ON public.vault_finds_products FOR SELECT TO anon,authenticated USING (active=true);