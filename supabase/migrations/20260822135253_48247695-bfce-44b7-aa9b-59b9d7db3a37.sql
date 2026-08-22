delete from public.marketplace_bundle_items
where bundle_id in (select id from public.marketplace_bundles where slug = 'qa-creator-os-trio');
delete from public.marketplace_bundles where slug = 'qa-creator-os-trio';