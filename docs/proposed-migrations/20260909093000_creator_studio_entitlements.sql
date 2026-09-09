-- AurumVault Creator Studio — CS4 entitlements and usage accounting
-- PROPOSAL ONLY. Apply first to isolated staging.

create table if not exists public.creator_studio_entitlements (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  plan_key text not null default 'FREE' check (plan_key in ('FREE','CREATOR_PRO','CREATOR_BUSINESS')),
  period_start timestamptz not null default date_trunc('month', now()),
  period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  included_videos integer not null default 1 check (included_videos >= 0),
  extra_video_credits integer not null default 0 check (extra_video_credits >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_studio_usage (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  render_job_id uuid not null references public.creator_studio_render_jobs(id) on delete cascade,
  period_start timestamptz not null,
  units integer not null default 1 check (units > 0),
  source text not null check (source in ('INCLUDED','EXTRA_CREDIT','FREE_PREVIEW')),
  state text not null default 'RESERVED' check (state in ('RESERVED','SETTLED','RELEASED')),
  reserved_at timestamptz not null default now(),
  settled_at timestamptz,
  released_at timestamptz,
  unique(render_job_id)
);

create index if not exists creator_studio_usage_owner_period_idx
  on public.creator_studio_usage(owner_user_id, period_start, state);

alter table public.creator_studio_entitlements enable row level security;
alter table public.creator_studio_usage enable row level security;

create policy creator_studio_entitlements_owner_read on public.creator_studio_entitlements
  for select to authenticated
  using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy creator_studio_usage_owner_read on public.creator_studio_usage
  for select to authenticated
  using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Entitlement and usage writes are server/service mediated only.
-- Stripe/webhook processing must never trust a client-supplied plan or credit count.
