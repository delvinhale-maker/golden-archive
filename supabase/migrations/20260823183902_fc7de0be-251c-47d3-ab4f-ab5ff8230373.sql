-- Additive taxonomy columns on marketplace_products
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS delivery_contents text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS primary_bundle_file_id uuid;

ALTER TABLE public.marketplace_products
  DROP CONSTRAINT IF EXISTS marketplace_products_primary_bundle_file_fk;

ALTER TABLE public.marketplace_products
  ADD CONSTRAINT marketplace_products_primary_bundle_file_fk
  FOREIGN KEY (primary_bundle_file_id)
  REFERENCES public.product_download_files(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS marketplace_products_product_type_idx
  ON public.marketplace_products (product_type);

-- Backfill product_type from existing category/subcategory (no rows destroyed)
UPDATE public.marketplace_products SET product_type = CASE
  WHEN category = 'business_operating_systems' AND coalesce(subcategory,'') = 'Interactive Decision Tools' THEN 'interactive_decision_tool'
  WHEN category = 'business_operating_systems' THEN 'complete_digital_system'
  WHEN category = 'creator_business_tools' THEN 'complete_digital_system'
  WHEN category = 'film_tv_creator_production' THEN 'creator_production_system'
  WHEN category = 'ebooks' THEN 'ebook'
  WHEN category IN ('financial_planners','printable_journals') THEN 'planner_journal'
  WHEN category = 'ai_prompt_packs' THEN 'prompt_system'
  WHEN category IN ('business_templates','templates','budget_spreadsheets','caption_templates','digital_toolkits') THEN 'template_workbook'
  WHEN category IN ('childrens_educational','bible_studies','courses') THEN 'educational_resource'
  WHEN category = 'audio' THEN 'audio'
  ELSE NULL
END
WHERE product_type IS NULL;

-- Normalized Business Systems system types (additive; existing names preserved)
INSERT INTO public.product_subcategories (category_slug, name, position)
SELECT 'business_operating_systems', v.name, v.position
FROM (VALUES
  ('Interactive Decision Tools', 1),
  ('Complete Business Systems', 2),
  ('Live Dashboards & Calculators', 3),
  ('Operating Systems', 4),
  ('Assessment & Scoring Tools', 5)
) AS v(name, position)
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_subcategories s
  WHERE s.category_slug = 'business_operating_systems' AND s.name = v.name
);

-- Creator Business Tools: add the two missing business functions
INSERT INTO public.product_subcategories (category_slug, name, position)
SELECT 'creator_business_tools', v.name, v.position
FROM (VALUES
  ('Rights & Licensing', 90),
  ('Creator Operations', 91)
) AS v(name, position)
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_subcategories s
  WHERE s.category_slug = 'creator_business_tools' AND s.name = v.name
);