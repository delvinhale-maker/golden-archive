CREATE TABLE public.product_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug text NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_slug, name)
);

GRANT SELECT ON public.product_subcategories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_subcategories TO authenticated;
GRANT ALL ON public.product_subcategories TO service_role;

ALTER TABLE public.product_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subcategories are viewable by everyone"
  ON public.product_subcategories FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert subcategories"
  ON public.product_subcategories FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update subcategories"
  ON public.product_subcategories FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete subcategories"
  ON public.product_subcategories FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER product_subcategories_touch_updated_at
  BEFORE UPDATE ON public.product_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.product_subcategories (category_slug, name, position) VALUES
  ('financial_planners', 'Financial Planners', 10),
  ('financial_planners', 'Wedding Planners', 20),
  ('financial_planners', 'Health & Wellness Planners', 30),
  ('financial_planners', 'Life & Productivity Planners', 40);

CREATE OR REPLACE FUNCTION public.admin_rename_subcategory(_category_slug text, _old_name text, _new_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  IF _new_name IS NULL OR length(btrim(_new_name)) = 0 THEN
    RAISE EXCEPTION 'new name is required';
  END IF;

  UPDATE public.product_subcategories
     SET name = btrim(_new_name)
   WHERE category_slug = _category_slug AND name = _old_name;

  UPDATE public.marketplace_products
     SET subcategory = btrim(_new_name)
   WHERE category::text = _category_slug AND subcategory = _old_name;
END;
$$;