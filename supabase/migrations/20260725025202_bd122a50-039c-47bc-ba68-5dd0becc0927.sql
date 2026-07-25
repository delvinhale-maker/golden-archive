
CREATE TABLE public.homepage_layout (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('section','affiliate')),
  position INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.homepage_layout TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homepage_layout TO authenticated;
GRANT ALL ON public.homepage_layout TO service_role;

ALTER TABLE public.homepage_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Homepage layout is publicly readable"
  ON public.homepage_layout FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert homepage layout"
  ON public.homepage_layout FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update homepage layout"
  ON public.homepage_layout FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete homepage layout"
  ON public.homepage_layout FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER homepage_layout_touch
  BEFORE UPDATE ON public.homepage_layout
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.homepage_layout (key, kind, position, label) VALUES
  ('new_releases', 'section', 10, 'New Releases (Just Dropped)'),
  ('kingdom_picks', 'section', 20, 'Kingdom Picks'),
  ('category_grid', 'section', 30, 'Category Grid'),
  ('featured_products', 'section', 40, 'Featured Products'),
  ('illustrious_creator', 'section', 50, 'Featured Creator'),
  ('vault_finds_row', 'affiliate', 10, 'Vault Finds — Row'),
  ('vault_finds_grid', 'affiliate', 20, 'Vault Finds — More Grid'),
  ('vault_finds_category_sections', 'affiliate', 30, 'Vault Finds — Category Sections');
