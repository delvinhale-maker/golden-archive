insert into public.product_subcategories (category_slug, name, position) values
 ('business_operating_systems','AI Business Systems',1),
 ('business_operating_systems','Creator Business Systems',2),
 ('business_operating_systems','Marketing Systems',3),
 ('business_operating_systems','Sales & Client Systems',4),
 ('business_operating_systems','Operations & Productivity Systems',5),
 ('business_operating_systems','Interactive Decision Tools',6)
on conflict do nothing;