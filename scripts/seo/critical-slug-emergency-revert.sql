-- EMERGENCY ONLY — URL ROLLBACK FOR THE 17 CRITICAL SLUG CHANGES.
-- Do not run for normal SEO preference changes.
-- This preserves each NEW slug as a redirect before restoring the OLD slug.
-- Use only if a verified production incident requires reverting the canonical URLs.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table _critical_slug_revert (
  product_id uuid primary key,
  expected_title text not null,
  old_slug text not null,
  new_slug text not null unique
) on commit drop;

insert into _critical_slug_revert(product_id, expected_title, old_slug, new_slug)
values
    ('e485dfcb-cbc4-4e58-a7b2-d01194d91f59'::uuid, 'Banking AI Governance Operations', '0', 'banking-ai-governance-operations'),
    ('dd495922-eddc-437a-914c-8c27ab7f056e'::uuid, 'Creator Brand Sponsorship OS', 'creat', 'creator-brand-sponsorship-os'),
    ('33f89f3b-fb71-45c8-a151-2fa0631752e9'::uuid, 'Everybody''s Rich Except Me', 'every', 'everybodys-rich-except-me'),
    ('e0503ba0-2722-404c-933e-34542575c46a'::uuid, 'Home and Insurance Disaster OS', 'home-and-ins', 'home-and-insurance-disaster-os'),
    ('1158950a-afa3-4260-96f7-0741b7bff38e'::uuid, 'Method of Verification The System', 'me', 'method-of-verification-the-system'),
    ('b9b4d507-894a-4d6d-a7af-b210943e9946'::uuid, 'My First A.I. Dictionary', 'my-first-a-i-di', 'my-first-ai-dictionary'),
    ('d278a83f-4e64-4a33-8a2c-d8e20f806fee'::uuid, 'My First Cyber Security Dictionary', 'my-first', 'my-first-cyber-security-dictionary'),
    ('0a16faa4-446f-4367-99e8-3779358d27ad'::uuid, 'My First Technology Dictionary', 'my', 'my-first-technology-dictionary'),
    ('95cf8686-8aff-4063-a6ac-2bf028ad5c9b'::uuid, 'P.O.D.', 'p-o-v', 'p-o-d'),
    ('4a7172a4-55ca-4d92-8eda-128cd0a533cf'::uuid, 'Reality Show Creator OS', 'reali', 'reality-show-creator-os'),
    ('1d613875-ee44-46c6-88c1-7b76584ed41b'::uuid, 'The Creator Performance & ROI Operating System', 'the-creator-per', 'creator-performance-roi-operating-system'),
    ('a0be6072-b10c-4ddb-aee3-fbe01d56fd3f'::uuid, 'The Digital Product Seller Content Vault', 'the', 'digital-product-seller-content-vault'),
    ('b96b111d-8fbd-412c-8686-c2ee9a19f2a6'::uuid, 'The GLP-1 Decision', 'g', 'glp-1-decision'),
    ('067305cd-f20b-46dc-ba60-975fbb71a374'::uuid, 'The Group Chat Disaster', 'the-group-chat-dis', 'group-chat-disaster'),
    ('7afc2894-6d11-48dd-b8fe-53fdbd08360c'::uuid, 'The Interactive Influencer Media Kit Builder', 'the-interactive', 'interactive-influencer-media-kit-builder'),
    ('af6da981-a870-4c20-a91e-5a427c0cc137'::uuid, 'The Legacy End of Life Planner', 'the-legacy-end-if-life-planner', 'legacy-end-of-life-planner');

insert into _critical_slug_revert(product_id, expected_title, old_slug, new_slug)
select
  'cde06c9c-80a7-4c82-a30f-fa1a8ec58831'::uuid,
  'The Interactive Social Media Content Planner',
  r.old_slug,
  'interactive-social-media-content-planner'
from public.product_slug_redirects r
where r.product_id = 'cde06c9c-80a7-4c82-a30f-fa1a8ec58831'::uuid
  and r.old_slug <> 'interactive-social-media-content-planner'
order by r.created_at desc
limit 1;

select m.id
from public.marketplace_products m
join _critical_slug_revert p on p.product_id = m.id
for update;

do $$
declare exact_count integer; old_collision_count integer;
begin
  select count(*) into exact_count
  from _critical_slug_revert p
  join public.marketplace_products m
    on m.id = p.product_id
   and m.title = p.expected_title
   and m.slug = p.new_slug;
  if exact_count <> 17 then
    raise exception 'Emergency slug revert blocked: expected 17 exact current new slugs, found %', exact_count;
  end if;

  select count(*) into old_collision_count
  from _critical_slug_revert p
  join public.marketplace_products m
    on m.slug = p.old_slug
   and m.id <> p.product_id;
  if old_collision_count <> 0 then
    raise exception 'Emergency slug revert blocked: % old slug collision(s)', old_collision_count;
  end if;
end $$;

-- Preserve the current/new URLs before restoring the old canonicals.
insert into public.product_slug_redirects(old_slug, product_id, reason)
select new_slug, product_id, 'Emergency canonical slug rollback alias'
from _critical_slug_revert
on conflict (old_slug_key) do nothing;

update public.marketplace_products m
set slug = p.old_slug,
    updated_at = now()
from _critical_slug_revert p
where m.id = p.product_id
  and m.slug = p.new_slug;

do $$
declare restored integer; new_aliases integer;
begin
  select count(*) into restored
  from _critical_slug_revert p
  join public.marketplace_products m
    on m.id = p.product_id
   and m.slug = p.old_slug;
  if restored <> 17 then
    raise exception 'Emergency slug revert postflight failed: expected 17 restored slugs, found %', restored;
  end if;

  select count(*) into new_aliases
  from _critical_slug_revert p
  join public.product_slug_redirects r
    on r.old_slug_key = md5(p.new_slug)
   and r.old_slug = p.new_slug
   and r.product_id = p.product_id;
  if new_aliases <> 17 then
    raise exception 'Emergency slug revert postflight failed: expected 17 new-url aliases, found %', new_aliases;
  end if;
end $$;

commit;
