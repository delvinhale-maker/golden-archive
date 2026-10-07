-- AurumVault Creator Studio — CS3 render jobs
-- PROPOSAL ONLY. Apply first to isolated staging.

create table if not exists public.creator_studio_render_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.creator_studio_projects(id) on delete cascade,
  provider text not null default 'SHOTSTACK' check (provider = 'SHOTSTACK'),
  provider_environment text not null check (provider_environment in ('stage','v1')),
  provider_render_id uuid,
  status text not null default 'RESERVED' check (status in ('RESERVED','QUEUED','FETCHING','PREPROCESSING','RENDERING','SAVING','COMPLETED','FAILED','CANCELLED')),
  idempotency_key text not null,
  template_key text not null,
  template_revision integer not null check (template_revision > 0),
  duration_seconds integer not null check (duration_seconds in (15,30,45)),
  output_url text,
  provider_error_code text,
  estimated_cost_usd numeric(10,4) not null default 0,
  actual_cost_usd numeric(10,4),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  unique(owner_user_id, idempotency_key),
  unique(provider, provider_render_id)
);

create index if not exists creator_studio_render_jobs_owner_idx on public.creator_studio_render_jobs(owner_user_id, created_at desc);
create index if not exists creator_studio_render_jobs_project_idx on public.creator_studio_render_jobs(project_id, created_at desc);

alter table public.creator_studio_render_jobs enable row level security;

create policy creator_studio_render_jobs_owner_read on public.creator_studio_render_jobs
  for select to authenticated
  using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Writes are intentionally server/service mediated. No authenticated insert/update/delete policy.
