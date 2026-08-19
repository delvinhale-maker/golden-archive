INSERT INTO public.product_subcategories (category_slug, name, position)
VALUES
  ('film_tv_creator_production', 'Vertical Series & Microdrama', 1),
  ('film_tv_creator_production', 'Film & Tubi-Style Production', 2),
  ('film_tv_creator_production', 'Reality TV', 3),
  ('film_tv_creator_production', 'YouTube & Social Video', 4),
  ('film_tv_creator_production', 'Music & Entertainment', 5),
  ('film_tv_creator_production', 'Pitching & Distribution', 6),
  ('film_tv_creator_production', 'AI Creator Tools', 7)
ON CONFLICT DO NOTHING;