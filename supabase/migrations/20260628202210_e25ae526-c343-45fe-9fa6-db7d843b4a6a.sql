
-- 1. AFFILIATE PRODUCTS
CREATE TABLE public.affiliate_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  original_price numeric(10,2),
  image_url text NOT NULL,
  affiliate_url text NOT NULL,
  source text NOT NULL CHECK (source IN ('amazon','walmart')),
  category text NOT NULL DEFAULT 'eBooks',
  badge text,
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.affiliate_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_products TO authenticated;
GRANT ALL ON public.affiliate_products TO service_role;

ALTER TABLE public.affiliate_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active affiliate products"
  ON public.affiliate_products FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert affiliate products"
  ON public.affiliate_products FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update affiliate products"
  ON public.affiliate_products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete affiliate products"
  ON public.affiliate_products FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER affiliate_products_touch
  BEFORE UPDATE ON public.affiliate_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX affiliate_products_active_featured_idx
  ON public.affiliate_products (active, featured DESC, created_at DESC);

-- 2. AFFILIATE CLICKS
CREATE TABLE public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.affiliate_products(id) ON DELETE CASCADE,
  affiliate_url text NOT NULL,
  source text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.affiliate_clicks TO anon;
GRANT INSERT, SELECT ON public.affiliate_clicks TO authenticated;
GRANT ALL ON public.affiliate_clicks TO service_role;

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log an affiliate click"
  ON public.affiliate_clicks FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view affiliate clicks"
  ON public.affiliate_clicks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX affiliate_clicks_product_idx ON public.affiliate_clicks (product_id, clicked_at DESC);

-- 3. SEED DATA
INSERT INTO public.affiliate_products
  (title, description, price, original_price, image_url, affiliate_url, source, category, badge, featured)
VALUES
  ('The Total Money Makeover',
   'Dave Ramsey''s proven plan for getting out of debt and building wealth God''s way.',
   14.99, 27.99,
   'https://images-na.ssl-images-amazon.com/images/I/71xWfn4FbtL._SL1500_.jpg',
   'https://www.amazon.com/dp/1595555277?tag=aurumvault-20',
   'amazon', 'Finance', 'Bestseller', true),
  ('Atomic Habits',
   'James Clear''s framework for building good habits and breaking bad ones — one percent better every day.',
   13.79, 27.00,
   'https://images-na.ssl-images-amazon.com/images/I/81wgcld4wxL._SL1500_.jpg',
   'https://www.amazon.com/dp/0735211299?tag=aurumvault-20',
   'amazon', 'Leadership', 'Kingdom Pick', true),
  ('The Purpose Driven Life',
   'Rick Warren''s 40-day spiritual journey to discover the answer to life''s most important question.',
   11.49, 24.99,
   'https://images-na.ssl-images-amazon.com/images/I/81q4njpEhsL._SL1500_.jpg',
   'https://www.amazon.com/dp/0310337518?tag=aurumvault-20',
   'amazon', 'Purpose', 'Staff Favorite', false),
  ('NIV Study Bible — Hardcover',
   'Comprehensive notes, maps, and articles to deepen your understanding of Scripture.',
   29.97, 49.99,
   'https://i5.walmartimages.com/asr/9b6f6a8e-7b3d-43e0-8a6b-1b1f1b1f1b1f.jpeg',
   'https://goto.walmart.com/c/aurumvault/NIV-Study-Bible',
   'walmart', 'eBooks', 'Bestseller', false),
  ('Boundaries Workbook — Cloud & Townsend',
   'Practical exercises to take control of your life and build healthy relationships.',
   12.88, 19.99,
   'https://i5.walmartimages.com/asr/c4d4e4f4-g4h4-43e0-8a6b-1b1f1b1f1b1f.jpeg',
   'https://goto.walmart.com/c/aurumvault/Boundaries-Workbook',
   'walmart', 'Leadership', NULL, false),
  ('The Action Bible — Children''s Edition',
   'God''s redemptive story brought to life with full-color illustrations for young readers.',
   19.97, 34.99,
   'https://i5.walmartimages.com/asr/d5e5f5g5-h5i5-43e0-8a6b-1b1f1b1f1b1f.jpeg',
   'https://goto.walmart.com/c/aurumvault/Action-Bible-Childrens',
   'walmart', 'Children', 'Kingdom Pick', false);
