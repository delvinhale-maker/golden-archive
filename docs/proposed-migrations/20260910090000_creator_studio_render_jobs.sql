-- AurumVault Creator Studio — CS3 render jobs
-- PROPOSAL ONLY. Apply first to isolated staging in CS5.

create table if not exists public.creator_studio_render_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.creator_studio_projects(id) on delete cascade,
  idempotency_key text not null,
  provider text not null default 'SHOTSTACK' check (provider = 'SHOTSTACK'),
  provider_environment text not null check (provider_environment in ('stage','v1')),
  provider_render_id text,
  status text not null default 'DRAFT' check (status in ('DRAFT','QUEUED','FETCHING','PREPROCESSING','RENDERING','SAVING','COMPLETED','FAILED','CANCELLED')),
  render_plan jsonb not null,
  output_url text,
  failure_code text,
  estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0),
  actual_cost_cents integer check (actual_cost_cents is null or actual_cost_cents >= 0),
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, idempotency_key)
);

create index if not exists creator_studio_render_jobs_project_idx
  on public.creator_studio_render_jobs(project_id, created_at desc);
create unique index if not exists creator_studio_render_jobs_provider_id_idx
  on public.creator_studio_render_jobs(provider, provider_environment, provider_render_id)
  where provider_render_id is not null;

alter table public.creator_studio_render_jobs enable row level security;

create policy creator_studio_render_jobs_owner_read on public.creator_studio_render_jobs
  for select to authenticated
  using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy creator_studio_render_jobs_owner_insert on public.creator_studio_render_jobs
  for insert to authenticated
  with check (
    (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    and exists (
      select 1 from public.creator_studio_projects p
      where p.id = project_id
        and (p.owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  );
create policy creator_studio_render_jobs_owner_update on public.creator_studio_render_jobs
  for update to authenticated
  using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (
    (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    and exists (
      select 1 from public.creator_studio_projects p
      where p.id = project_id
        and (p.owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  );

revoke delete on table public.creator_studio_render_jobs from anon, authenticated;
