insert into public.marketplace_products (
  seller_id, title, subtitle, description, category, subcategory, product_type,
  price_cents, compare_at_price_cents, status, published, slug, language,
  delivery_contents, creator_name, approved_at, released_at
)
select
  '02579d2f-e0c1-4f53-b0e8-abedf18e4d4f',
  'Film Distribution Readiness & Deliverables OS™',
  'Get your film distribution-ready with a guided readiness engine and full deliverables tracker',
  'A complete digital system for filmmakers preparing for distribution. Includes a guided readiness assessment, a deliverables tracker workbook, and a downloadable bundle of templates and checklists covering technical, legal, and marketing deliverables required by distributors, sales agents, and streaming platforms.',
  'film_tv_creator_production',
  'Film, Video & Production',
  'complete_digital_system',
  4900, 9900, 'approved', true,
  'film-distribution-readiness-deliverables-os',
  'English',
  ARRAY['PDF','XLSX','ZIP','Decision Engine','Live Tool Included']::text[],
  'AurumVault Studio',
  now(), now()
where not exists (
  select 1 from public.marketplace_products where slug = 'film-distribution-readiness-deliverables-os'
);

update public.marketplace_products
set delivery_contents = ARRAY['PDF','XLSX','ZIP','Decision Engine','Live Tool Included']::text[],
    product_type = 'complete_digital_system',
    status = 'approved',
    published = true
where slug = 'film-distribution-readiness-deliverables-os';