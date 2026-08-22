insert into public.marketplace_bundles (slug, name, short_description, full_description, price_cents, featured, status, owner_seller_id)
values ('qa-creator-os-trio','QA Creator OS Trio','Temporary QA bundle','Internal QA bundle used to verify checkout end to end.', 9900, true, 'active', '02579d2f-e0c1-4f53-b0e8-abedf18e4d4f')
on conflict (slug) do update set status='active', price_cents=9900;

insert into public.marketplace_bundle_items (bundle_id, product_id, position, required)
select b.id, p.id, p.ord, true
from public.marketplace_bundles b
cross join (values
  ('a36f1463-5443-47d2-b07f-1aa633991c41'::uuid, 0),
  ('4a7172a4-55ca-4d92-8eda-128cd0a533cf'::uuid, 1),
  ('1c54ace4-7615-4133-9428-b55f5ec0ac89'::uuid, 2)
) as p(id, ord)
where b.slug = 'qa-creator-os-trio'
on conflict do nothing;