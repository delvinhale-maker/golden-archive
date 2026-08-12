ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'caption_templates';

INSERT INTO public.product_subcategories (category_slug, name, position)
SELECT 'caption_templates', v.name, v.position
FROM (VALUES
  ('Realtor Caption Templates', 1),
  ('Beauty Business Caption Templates', 2),
  ('Digital Product Seller Caption Templates', 3),
  ('Credit & Finance Caption Templates', 4),
  ('Author & KDP Caption Templates', 5),
  ('Faith-Based Entrepreneur Caption Templates', 6),
  ('Photographer Caption Templates', 7),
  ('Coach Caption Templates', 8),
  ('Boutique Caption Templates', 9),
  ('Restaurant Caption Templates', 10)
) AS v(name, position)
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_subcategories p
  WHERE p.category_slug = 'caption_templates' AND p.name = v.name
);