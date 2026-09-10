-- AurumVault Creator Studio — CS1 foundation
-- PROPOSAL ONLY. Apply first to an isolated staging backend.

create table if not exists public.creator_studio_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled video project',
  goal text not null check (goal in ('PROMOTE_EBOOK','PROMOTE_COURSE','PROMOTE_PLANNER','TIKTOK_AD','INSTAGRAM_REEL','PRODUCT_TRAILER','BOOK_TRAILER')),
  status text not null default 'DRAFT' check (status in ('DRAFT','READY','RENDERING','COMPLETED','FAILED','ARCHIVED')),
  duration_seconds integer not null default 30 check (duration_seconds in (15,30,45)),
  aspect_ratio text not null default '9:16' check (aspect_ratio = '9:16'),
  style_key text not null default 'LUXURY_EDITORIAL',
  product_title text,
  call_to_action text,
  destination_url text,
  price_label text,
  wizard_step integer not null default 1 check (wizard_step between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.creator_studio_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.creator_studio_projects(id) on delete cascade,
  kind text not null check (kind in ('COVER','SCREENSHOT','LOGO','OTHER')),
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  width integer,
  height integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists creator_studio_projects_owner_idx on public.creator_studio_projects(owner_user_id, created_at desc);
create index if not exists creator_studio_assets_project_idx on public.creator_studio_assets(project_id, sort_order);

alter table public.creator_studio_projects enable row level security;
alter table public.creator_studio_assets enable row level security;

create policy creator_studio_projects_owner_read on public.creator_studio_projects
  for select to authenticated
  using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy creator_studio_projects_owner_insert on public.creator_studio_projects
  for insert to authenticated
  with check (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy creator_studio_projects_owner_update on public.creator_studio_projects
  for update to authenticated
  using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy creator_studio_assets_owner_read on public.creator_studio_assets
  for select to authenticated
  using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy creator_studio_assets_owner_insert on public.creator_studio_assets
  for insert to authenticated
  with check (
    (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    and exists (
      select 1 from public.creator_studio_projects p
      where p.id = project_id
        and (p.owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  );
create policy creator_studio_assets_owner_update on public.creator_studio_assets
  for update to authenticated
  using (
    (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    and exists (
      select 1 from public.creator_studio_projects p
      where p.id = project_id
        and (p.owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  )
  with check (
    (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    and exists (
      select 1 from public.creator_studio_projects p
      where p.id = project_id
        and (p.owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  );

-- Defense in depth: CS1 supports soft archive, not destructive table deletion.
revoke delete on table public.creator_studio_projects from anon, authenticated;
revoke delete on table public.creator_studio_assets from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('creator-studio-assets', 'creator-studio-assets', false)
on conflict (id) do update set public = false;

create policy creator_studio_assets_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'creator-studio-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy creator_studio_assets_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'creator-studio-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy creator_studio_assets_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'creator-studio-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'creator-studio-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Intentionally no DELETE storage policy. Orphan cleanup, if introduced later,
-- must be a trusted server-side maintenance operation rather than a client grant.
