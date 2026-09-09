-- READ-ONLY POSTFLIGHT AUDIT — CRITICAL PRODUCT SLUG CLEANUP
-- Run immediately after critical-slug-cleanup.sql and again after app deployment.

with expected(product_id, expected_title, new_slug) as (
  values
    ('e485dfcb-cbc4-4e58-a7b2-d01194d91f59'::uuid, 'Banking AI Governance Operations', 'banking-ai-governance-operations'),
    ('dd495922-eddc-437a-914c-8c27ab7f056e'::uuid, 'Creator Brand Sponsorship OS', 'creator-brand-sponsorship-os'),
    ('33f89f3b-fb71-45c8-a151-2fa0631752e9'::uuid, 'Everybody''s Rich Except Me', 'everybodys-rich-except-me'),
    ('e0503ba0-2722-404c-933e-34542575c46a'::uuid, 'Home and Insurance Disaster OS', 'home-and-insurance-disaster-os'),
    ('1158950a-afa3-4260-96f7-0741b7bff38e'::uuid, 'Method of Verification The System', 'method-of-verification-the-system'),
    ('b9b4d507-894a-4d6d-a7af-b210943e9946'::uuid, 'My First A.I. Dictionary', 'my-first-ai-dictionary'),
    ('d278a83f-4e64-4a33-8a2c-d8e20f806fee'::uuid, 'My First Cyber Security Dictionary', 'my-first-cyber-security-dictionary'),
    ('0a16faa4-446f-4367-99e8-3779358d27ad'::uuid, 'My First Technology Dictionary', 'my-first-technology-dictionary'),
    ('95cf8686-8aff-4063-a6ac-2bf028ad5c9b'::uuid, 'P.O.D.', 'p-o-d'),
    ('4a7172a4-55ca-4d92-8eda-128cd0a533cf'::uuid, 'Reality Show Creator OS', 'reality-show-creator-os'),
    ('1d613875-ee44-46c6-88c1-7b76584ed41b'::uuid, 'The Creator Performance & ROI Operating System', 'creator-performance-roi-operating-system'),
    ('a0be6072-b10c-4ddb-aee3-fbe01d56fd3f'::uuid, 'The Digital Product Seller Content Vault', 'digital-product-seller-content-vault'),
    ('b96b111d-8fbd-412c-8686-c2ee9a19f2a6'::uuid, 'The GLP-1 Decision', 'glp-1-decision'),
    ('067305cd-f20b-46dc-ba60-975fbb71a374'::uuid, 'The Group Chat Disaster', 'group-chat-disaster'),
    ('7afc2894-6d11-48dd-b8fe-53fdbd08360c'::uuid, 'The Interactive Influencer Media Kit Builder', 'interactive-influencer-media-kit-builder'),
    ('cde06c9c-80a7-4c82-a30f-fa1a8ec58831'::uuid, 'The Interactive Social Media Content Planner', 'interactive-social-media-content-planner'),
    ('af6da981-a870-4c20-a91e-5a427c0cc137'::uuid, 'The Legacy End of Life Planner', 'legacy-end-of-life-planner')
),
audit as (
  select
    e.product_id,
    e.expected_title,
    e.new_slug,
    m.slug as live_slug,
    m.status::text as live_status,
    m.published,
    (m.slug = e.new_slug) as canonical_slug_ok,
    exists (
      select 1
      from public.product_slug_redirects r
      where r.product_id = e.product_id
        and r.old_slug <> e.new_slug
    ) as has_historical_redirect
  from expected e
  left join public.marketplace_products m on m.id = e.product_id
)
select
  case
    when count(*) = 17
      and count(*) filter (where canonical_slug_ok) = 17
      and count(*) filter (where has_historical_redirect) = 17
      and count(*) filter (where live_status = 'approved' and published = true) = 17
    then 'PASS'
    else 'FAIL'
  end as decision,
  count(*) as audited,
  count(*) filter (where canonical_slug_ok) as canonical_slugs_ok,
  count(*) filter (where has_historical_redirect) as historical_redirects_present,
  count(*) filter (where live_status = 'approved' and published = true) as still_public
from audit;

with expected(product_id, expected_title, new_slug) as (
  values
    ('e485dfcb-cbc4-4e58-a7b2-d01194d91f59'::uuid, 'Banking AI Governance Operations', 'banking-ai-governance-operations'),
    ('dd495922-eddc-437a-914c-8c27ab7f056e'::uuid, 'Creator Brand Sponsorship OS', 'creator-brand-sponsorship-os'),
    ('33f89f3b-fb71-45c8-a151-2fa0631752e9'::uuid, 'Everybody''s Rich Except Me', 'everybodys-rich-except-me'),
    ('e0503ba0-2722-404c-933e-34542575c46a'::uuid, 'Home and Insurance Disaster OS', 'home-and-insurance-disaster-os'),
    ('1158950a-afa3-4260-96f7-0741b7bff38e'::uuid, 'Method of Verification The System', 'method-of-verification-the-system'),
    ('b9b4d507-894a-4d6d-a7af-b210943e9946'::uuid, 'My First A.I. Dictionary', 'my-first-ai-dictionary'),
    ('d278a83f-4e64-4a33-8a2c-d8e20f806fee'::uuid, 'My First Cyber Security Dictionary', 'my-first-cyber-security-dictionary'),
    ('0a16faa4-446f-4367-99e8-3779358d27ad'::uuid, 'My First Technology Dictionary', 'my-first-technology-dictionary'),
    ('95cf8686-8aff-4063-a6ac-2bf028ad5c9b'::uuid, 'P.O.D.', 'p-o-d'),
    ('4a7172a4-55ca-4d92-8eda-128cd0a533cf'::uuid, 'Reality Show Creator OS', 'reality-show-creator-os'),
    ('1d613875-ee44-46c6-88c1-7b76584ed41b'::uuid, 'The Creator Performance & ROI Operating System', 'creator-performance-roi-operating-system'),
    ('a0be6072-b10c-4ddb-aee3-fbe01d56fd3f'::uuid, 'The Digital Product Seller Content Vault', 'digital-product-seller-content-vault'),
    ('b96b111d-8fbd-412c-8686-c2ee9a19f2a6'::uuid, 'The GLP-1 Decision', 'glp-1-decision'),
    ('067305cd-f20b-46dc-ba60-975fbb71a374'::uuid, 'The Group Chat Disaster', 'group-chat-disaster'),
    ('7afc2894-6d11-48dd-b8fe-53fdbd08360c'::uuid, 'The Interactive Influencer Media Kit Builder', 'interactive-influencer-media-kit-builder'),
    ('cde06c9c-80a7-4c82-a30f-fa1a8ec58831'::uuid, 'The Interactive Social Media Content Planner', 'interactive-social-media-content-planner'),
    ('af6da981-a870-4c20-a91e-5a427c0cc137'::uuid, 'The Legacy End of Life Planner', 'legacy-end-of-life-planner')
)
select
  e.product_id,
  e.expected_title,
  e.new_slug,
  m.slug as live_slug,
  m.status::text as live_status,
  m.published,
  array(
    select r.old_slug
    from public.product_slug_redirects r
    where r.product_id = e.product_id
    order by r.created_at
  ) as historical_slugs
from expected e
left join public.marketplace_products m on m.id = e.product_id
order by e.expected_title;
