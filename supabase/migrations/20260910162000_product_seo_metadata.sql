-- Phase 2: additive product SEO metadata fields.
-- This migration intentionally does not update existing product rows.

alter table public.marketplace_products
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_focus_keyword text,
  add column if not exists seo_secondary_keywords text[] not null default '{}'::text[],
  add column if not exists seo_image_alt text,
  add column if not exists seo_og_title text,
  add column if not exists seo_og_description text,
  add column if not exists seo_robots_index boolean not null default true,
  add column if not exists seo_robots_follow boolean not null default true,
  add column if not exists seo_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'marketplace_products_seo_title_len'
  ) then
    alter table public.marketplace_products
      add constraint marketplace_products_seo_title_len
      check (seo_title is null or char_length(seo_title) <= 200);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'marketplace_products_seo_description_len'
  ) then
    alter table public.marketplace_products
      add constraint marketplace_products_seo_description_len
      check (seo_description is null or char_length(seo_description) <= 500);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'marketplace_products_seo_image_alt_len'
  ) then
    alter table public.marketplace_products
      add constraint marketplace_products_seo_image_alt_len
      check (seo_image_alt is null or char_length(seo_image_alt) <= 300);
  end if;
end $$;

comment on column public.marketplace_products.seo_focus_keyword is
  'Internal SEO planning field. Do not emit as a meta keywords tag.';
comment on column public.marketplace_products.seo_secondary_keywords is
  'Internal SEO planning terms. Do not emit as a meta keywords tag.';
