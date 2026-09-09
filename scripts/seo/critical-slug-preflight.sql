-- READ-ONLY PRODUCTION PREFLIGHT — CRITICAL PRODUCT SLUG CLEANUP
-- Persistent data changes: NONE.
-- Run only after the redirect infrastructure is deployed and verified.
-- Decision must be SAFE before running critical-slug-cleanup.sql.

with static_plan(product_id, expected_title, old_slug, new_slug) as (
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
    ('af6da981-a870-4c20-a91e-5a427c0cc137'::uuid, 'The Legacy End of Life Planner', 'the-legacy-end-if-life-planner', 'legacy-end-of-life-planner')
),
dynamic_plan as (
  select
    m.id as product_id,
    'The Interactive Social Media Content Planner'::text as expected_title,
    m.slug::text as old_slug,
    'interactive-social-media-content-planner'::text as new_slug
  from public.marketplace_products m
  where m.id = 'cde06c9c-80a7-4c82-a30f-fa1a8ec58831'::uuid
    and m.title = 'The Interactive Social Media Content Planner'
    and char_length(m.slug) >= 500
),
plan as (
  select * from static_plan
  union all
  select * from dynamic_plan
),
row_checks as (
  select
    p.product_id,
    p.expected_title,
    p.old_slug,
    p.new_slug,
    m.title as live_title,
    m.slug as live_slug,
    m.status::text as live_status,
    m.published as live_published,
    (m.id is not null) as product_exists,
    (m.title = p.expected_title) as title_matches,
    (m.slug = p.old_slug) as old_slug_matches,
    (m.status::text = 'approved' and m.published = true) as still_public,
    (p.new_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') as new_slug_format_ok,
    not exists (
      select 1
      from public.marketplace_products x
      where x.slug = p.new_slug
        and x.id <> p.product_id
    ) as target_slug_available,
    not exists (
      select 1
      from public.product_slug_redirects r
      where r.old_slug_key = md5(p.old_slug)
        and not (r.old_slug = p.old_slug and r.product_id = p.product_id)
    ) as redirect_key_available
  from plan p
  left join public.marketplace_products m on m.id = p.product_id
),
summary as (
  select
    (select count(*) from plan) as plan_rows,
    count(*) filter (where product_exists) as products_found,
    count(*) filter (where title_matches and old_slug_matches) as exact_old_state_matches,
    count(*) filter (where still_public) as public_products,
    count(*) filter (where new_slug_format_ok) as valid_new_slugs,
    count(*) filter (where target_slug_available) as available_targets,
    count(*) filter (where redirect_key_available) as available_redirect_keys,
    count(distinct product_id) as unique_product_ids,
    count(distinct new_slug) as unique_new_slugs
  from row_checks
)
select
  case
    when plan_rows = 17
      and products_found = 17
      and exact_old_state_matches = 17
      and public_products = 17
      and valid_new_slugs = 17
      and available_targets = 17
      and available_redirect_keys = 17
      and unique_product_ids = 17
      and unique_new_slugs = 17
    then 'SAFE'
    else 'BLOCKED'
  end as decision,
  *
from summary;

-- Detail output: every boolean below should be true.
with static_plan(product_id, expected_title, old_slug, new_slug) as (
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
    ('af6da981-a870-4c20-a91e-5a427c0cc137'::uuid, 'The Legacy End of Life Planner', 'the-legacy-end-if-life-planner', 'legacy-end-of-life-planner')
),
dynamic_plan as (
  select m.id, 'The Interactive Social Media Content Planner'::text, m.slug::text, 'interactive-social-media-content-planner'::text
  from public.marketplace_products m
  where m.id = 'cde06c9c-80a7-4c82-a30f-fa1a8ec58831'::uuid
    and m.title = 'The Interactive Social Media Content Planner'
    and char_length(m.slug) >= 500
),
plan as (
  select * from static_plan
  union all
  select * from dynamic_plan
)
select
  p.product_id,
  p.expected_title,
  p.old_slug,
  p.new_slug,
  (m.title = p.expected_title) as title_matches,
  (m.slug = p.old_slug) as old_slug_matches,
  (m.status::text = 'approved' and m.published = true) as still_public,
  not exists (
    select 1 from public.marketplace_products x
    where x.slug = p.new_slug and x.id <> p.product_id
  ) as target_slug_available,
  not exists (
    select 1 from public.product_slug_redirects r
    where r.old_slug_key = md5(p.old_slug)
      and not (r.old_slug = p.old_slug and r.product_id = p.product_id)
  ) as redirect_key_available
from plan p
left join public.marketplace_products m on m.id = p.product_id
order by p.expected_title;
