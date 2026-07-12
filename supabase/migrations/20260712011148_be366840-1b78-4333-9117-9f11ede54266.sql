
CREATE TABLE public.vault_finds_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL,
  subtext text NOT NULL,
  image_url text,
  affiliate_link text NOT NULL,
  accent_color text NOT NULL DEFAULT 'emerald' CHECK (accent_color IN ('emerald','burgundy','amber','dusty','cream')),
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vault_finds_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_finds_products TO authenticated;
GRANT ALL ON public.vault_finds_products TO service_role;

ALTER TABLE public.vault_finds_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active vault finds"
  ON public.vault_finds_products
  FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can read all vault finds"
  ON public.vault_finds_products
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert vault finds"
  ON public.vault_finds_products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update vault finds"
  ON public.vault_finds_products
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete vault finds"
  ON public.vault_finds_products
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER vault_finds_products_touch_updated_at
  BEFORE UPDATE ON public.vault_finds_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.vault_finds_products (headline, subtext, affiliate_link, accent_color, active)
VALUES (
  'See Everything. Miss Nothing.',
  'AI-powered smart glasses with built-in camera, voice control & instant recall.',
  'https://amzn.to/4eZr8w0',
  'dusty',
  true
);
