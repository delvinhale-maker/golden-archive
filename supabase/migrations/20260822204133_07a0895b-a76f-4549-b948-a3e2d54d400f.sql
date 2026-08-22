CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.brand_slug_normalize(_v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(regexp_replace(regexp_replace(lower(_v), '[^a-z0-9]+', '-', 'g'), '-{2,}', '-', 'g'), '-');
$$;

CREATE TABLE public.creator_storefront_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  headline text,
  logo_url text,
  accent text NOT NULL DEFAULT 'gold',
  featured_product_ids uuid[] NOT NULL DEFAULT '{}',
  featured_bundle_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_storefront_accent_allowed
    CHECK (accent IN ('gold','emerald','sapphire','burgundy','slate')),
  CONSTRAINT creator_storefront_headline_len CHECK (headline IS NULL OR char_length(headline) <= 90),
  CONSTRAINT creator_storefront_featured_max CHECK (array_length(featured_product_ids, 1) IS NULL OR array_length(featured_product_ids, 1) <= 6)
);

GRANT SELECT ON public.creator_storefront_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_storefront_settings TO authenticated;
GRANT ALL ON public.creator_storefront_settings TO service_role;

ALTER TABLE public.creator_storefront_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Storefront settings are publicly readable"
  ON public.creator_storefront_settings FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Creators manage their own storefront settings"
  ON public.creator_storefront_settings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER creator_storefront_settings_updated_at
  BEFORE UPDATE ON public.creator_storefront_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.creator_storefront_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL,
  kind text NOT NULL,
  product_id uuid,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_storefront_event_kind
    CHECK (kind IN ('storefront_view','product_click','share','qr'))
);

CREATE INDEX creator_storefront_events_creator_idx
  ON public.creator_storefront_events (creator_user_id, created_at DESC);

GRANT INSERT ON public.creator_storefront_events TO anon;
GRANT SELECT, INSERT ON public.creator_storefront_events TO authenticated;
GRANT ALL ON public.creator_storefront_events TO service_role;

ALTER TABLE public.creator_storefront_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a storefront event"
  ON public.creator_storefront_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Creators read only their own storefront events"
  ON public.creator_storefront_events FOR SELECT
  TO authenticated
  USING (auth.uid() = creator_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.seller_applications_guard_brand_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  reserved text[] := ARRAY[
    'admin','support','aurumvault','aurum-vault','checkout','login','logout',
    'creators','creator','account','marketplace','store','stores','auth','api',
    'cart','library','dashboard','products','bundles','academy','search','sell'
  ];
BEGIN
  IF NEW.brand_slug IS NULL OR btrim(NEW.brand_slug) = '' THEN
    NEW.brand_slug := NULL;
    RETURN NEW;
  END IF;

  NEW.brand_slug := public.brand_slug_normalize(NEW.brand_slug);

  IF char_length(coalesce(NEW.brand_slug, '')) < 3 THEN
    RAISE EXCEPTION 'Storefront address must be at least 3 characters';
  END IF;

  IF NEW.brand_slug = ANY(reserved) THEN
    RAISE EXCEPTION 'Storefront address "%" is reserved by AurumVault', NEW.brand_slug;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.seller_applications s
    WHERE s.brand_slug = NEW.brand_slug AND s.user_id <> NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Storefront address "%" is already taken', NEW.brand_slug;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER seller_applications_brand_slug_guard
  BEFORE INSERT OR UPDATE OF brand_slug ON public.seller_applications
  FOR EACH ROW EXECUTE FUNCTION public.seller_applications_guard_brand_slug();