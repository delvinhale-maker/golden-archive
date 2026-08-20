INSERT INTO public.product_subcategories (category_slug, name, position)
SELECT 'creator_business_tools', v.name, v.position
FROM (VALUES
  ('Media Kits & Rate Cards', 1),
  ('Brand Partnerships & Outreach', 2),
  ('Campaign Management', 3),
  ('Creator Analytics & Reporting', 4),
  ('Invoicing & Payments', 5),
  ('UGC & Client Systems', 6)
) AS v(name, position)
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_subcategories p
  WHERE p.category_slug = 'creator_business_tools' AND p.name = v.name
);