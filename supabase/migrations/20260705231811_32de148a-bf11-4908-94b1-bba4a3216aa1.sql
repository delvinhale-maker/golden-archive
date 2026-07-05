
-- Phase 3: Premium creator storefront schema

-- 1) Extended storefront fields on seller_applications
ALTER TABLE public.seller_applications
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS extended_bio TEXT,
  ADD COLUMN IF NOT EXISTS story TEXT,
  ADD COLUMN IF NOT EXISTS credentials TEXT[],
  ADD COLUMN IF NOT EXISTS featured_media_url TEXT;

-- Extend anon column grants to include new public storefront columns
GRANT SELECT
  (cover_url, extended_bio, story, credentials, featured_media_url)
  ON public.seller_applications
  TO anon;
GRANT SELECT
  (cover_url, extended_bio, story, credentials, featured_media_url)
  ON public.seller_applications
  TO authenticated;

-- 2) Creator followers
CREATE TABLE IF NOT EXISTS public.creator_followers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, creator_user_id)
);

GRANT SELECT ON public.creator_followers TO anon;
GRANT SELECT, INSERT, DELETE ON public.creator_followers TO authenticated;
GRANT ALL ON public.creator_followers TO service_role;

ALTER TABLE public.creator_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read followers"
  ON public.creator_followers FOR SELECT USING (true);

CREATE POLICY "Users follow as themselves"
  ON public.creator_followers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users unfollow themselves"
  ON public.creator_followers FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_creator_followers_creator
  ON public.creator_followers(creator_user_id);

-- 3) Creator bundles
CREATE TABLE IF NOT EXISTS public.creator_bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
  compare_at_price_cents BIGINT,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.creator_bundles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_bundles TO authenticated;
GRANT ALL ON public.creator_bundles TO service_role;

ALTER TABLE public.creator_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads published bundles"
  ON public.creator_bundles FOR SELECT
  USING (published = true);

CREATE POLICY "Sellers read own bundles"
  ON public.creator_bundles FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

CREATE POLICY "Sellers manage own bundles"
  ON public.creator_bundles FOR ALL
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE TRIGGER trg_creator_bundles_updated_at
  BEFORE UPDATE ON public.creator_bundles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Bundle items
CREATE TABLE IF NOT EXISTS public.creator_bundle_items (
  bundle_id UUID NOT NULL REFERENCES public.creator_bundles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (bundle_id, product_id)
);

GRANT SELECT ON public.creator_bundle_items TO anon;
GRANT SELECT, INSERT, DELETE ON public.creator_bundle_items TO authenticated;
GRANT ALL ON public.creator_bundle_items TO service_role;

ALTER TABLE public.creator_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads bundle items"
  ON public.creator_bundle_items FOR SELECT USING (true);

CREATE POLICY "Sellers manage own bundle items"
  ON public.creator_bundle_items FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.creator_bundles b
    WHERE b.id = bundle_id AND b.seller_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.creator_bundles b
    WHERE b.id = bundle_id AND b.seller_id = auth.uid()
  ));

-- 5) Storage policies for creator-covers bucket
CREATE POLICY "Public reads creator covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'creator-covers');

CREATE POLICY "Users upload own creator covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'creator-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own creator covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'creator-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own creator covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'creator-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
