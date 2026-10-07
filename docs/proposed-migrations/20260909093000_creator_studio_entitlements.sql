-- AurumVault Creator Studio — CS4 entitlements and usage accounting
-- PROPOSAL ONLY. Apply first to isolated staging.

create table if not exists public.creator_studio_entitlements (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  plan_key text not null default 'FREE' check (plan_key in ('FREE','CREATOR_PRO','CREATOR_BUSINESS')),
  period_start timestamptz not null default date_trunc('month', now()),
  period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  included_videos integer not null default 1 check (included_videos >= 0),
  extra_video_credits integer not null default 0 check (extra_video_credits >= 0),
  stripe_customer_id text,
  stripe_subscription_id text,
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

create table if not exists public.creator_studio_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  quantity integer not null check (quantity > 0),
  amount_paid_cents integer not null check (amount_paid_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists creator_studio_usage_owner_period_idx
  on public.creator_studio_usage(owner_user_id, period_start, state);
create index if not exists creator_studio_credit_purchases_owner_idx
  on public.creator_studio_credit_purchases(owner_user_id, created_at desc);

alter table public.creator_studio_entitlements enable row level security;
alter table public.creator_studio_usage enable row level security;
alter table public.creator_studio_credit_purchases enable row level security;

create policy creator_studio_entitlements_owner_read on public.creator_studio_entitlements
  for select to authenticated
  using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy creator_studio_usage_owner_read on public.creator_studio_usage
  for select to authenticated
  using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy creator_studio_credit_purchases_owner_read on public.creator_studio_credit_purchases
  for select to authenticated
  using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- All entitlement, usage and purchase writes are service mediated.
-- These functions are revoked from browser roles and called only with the service role.

create or replace function public.creator_studio_reserve_render(
  p_owner_user_id uuid,
  p_project_id uuid,
  p_idempotency_key text,
  p_template_key text,
  p_template_revision integer,
  p_duration_seconds integer,
  p_provider_environment text,
  p_estimated_cost_usd numeric
) returns table(allowed boolean, reason text, render_job_id uuid, existing_provider_render_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.creator_studio_entitlements%rowtype;
  existing public.creator_studio_render_jobs%rowtype;
  job_id uuid;
  usage_source text;
  used_count integer;
begin
  select * into existing from public.creator_studio_render_jobs
    where owner_user_id = p_owner_user_id and idempotency_key = p_idempotency_key;
  if found then
    return query select true, null::text, existing.id, existing.provider_render_id;
    return;
  end if;

  insert into public.creator_studio_entitlements(owner_user_id)
  values (p_owner_user_id)
  on conflict (owner_user_id) do nothing;

  select * into ent from public.creator_studio_entitlements
    where owner_user_id = p_owner_user_id for update;

  if now() >= ent.period_end then
    ent.period_start := date_trunc('month', now());
    ent.period_end := ent.period_start + interval '1 month';
    update public.creator_studio_entitlements
      set period_start = ent.period_start, period_end = ent.period_end, updated_at = now()
      where owner_user_id = p_owner_user_id;
  end if;

  select count(*) into used_count from public.creator_studio_usage
    where owner_user_id = p_owner_user_id
      and period_start = ent.period_start
      and state in ('RESERVED','SETTLED')
      and source in ('INCLUDED','FREE_PREVIEW');

  if ent.plan_key = 'FREE' then
    if used_count >= 1 then
      return query select false, 'FREE_PREVIEW_USED'::text, null::uuid, null::uuid;
      return;
    end if;
    usage_source := 'FREE_PREVIEW';
  elsif used_count < ent.included_videos then
    usage_source := 'INCLUDED';
  elsif ent.extra_video_credits > 0 then
    usage_source := 'EXTRA_CREDIT';
    update public.creator_studio_entitlements
      set extra_video_credits = extra_video_credits - 1, updated_at = now()
      where owner_user_id = p_owner_user_id;
  else
    return query select false, 'MONTHLY_ALLOWANCE_EXHAUSTED'::text, null::uuid, null::uuid;
    return;
  end if;

  insert into public.creator_studio_render_jobs(
    owner_user_id, project_id, provider_environment, idempotency_key,
    template_key, template_revision, duration_seconds, estimated_cost_usd
  ) values (
    p_owner_user_id, p_project_id, p_provider_environment, p_idempotency_key,
    p_template_key, p_template_revision, p_duration_seconds, p_estimated_cost_usd
  ) returning id into job_id;

  insert into public.creator_studio_usage(owner_user_id, render_job_id, period_start, source)
  values (p_owner_user_id, job_id, ent.period_start, usage_source);

  return query select true, null::text, job_id, null::uuid;
end;
$$;

create or replace function public.creator_studio_settle_render(p_render_job_id uuid, p_owner_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.creator_studio_usage
    set state = 'SETTLED', settled_at = coalesce(settled_at, now())
    where render_job_id = p_render_job_id and owner_user_id = p_owner_user_id and state = 'RESERVED';
end;
$$;

create or replace function public.creator_studio_release_render(p_render_job_id uuid, p_owner_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  released_source text;
begin
  update public.creator_studio_usage
    set state = 'RELEASED', released_at = coalesce(released_at, now())
    where render_job_id = p_render_job_id and owner_user_id = p_owner_user_id and state = 'RESERVED'
    returning source into released_source;
  if released_source = 'EXTRA_CREDIT' then
    update public.creator_studio_entitlements
      set extra_video_credits = extra_video_credits + 1, updated_at = now()
      where owner_user_id = p_owner_user_id;
  end if;
end;
$$;

create or replace function public.creator_studio_grant_extra_credits(
  p_owner_user_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_quantity integer,
  p_amount_paid_cents integer
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_quantity <= 0 then raise exception 'invalid quantity'; end if;
  insert into public.creator_studio_entitlements(owner_user_id)
    values (p_owner_user_id) on conflict (owner_user_id) do nothing;
  insert into public.creator_studio_credit_purchases(
    owner_user_id, stripe_checkout_session_id, stripe_payment_intent_id, quantity, amount_paid_cents
  ) values (p_owner_user_id, p_checkout_session_id, p_payment_intent_id, p_quantity, p_amount_paid_cents)
  on conflict (stripe_checkout_session_id) do nothing;
  if not found then return false; end if;
  update public.creator_studio_entitlements
    set extra_video_credits = extra_video_credits + p_quantity, updated_at = now()
    where owner_user_id = p_owner_user_id;
  return true;
end;
$$;

revoke execute on function public.creator_studio_reserve_render(uuid,uuid,text,text,integer,integer,text,numeric) from public, anon, authenticated;
revoke execute on function public.creator_studio_settle_render(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.creator_studio_release_render(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.creator_studio_grant_extra_credits(uuid,text,text,integer,integer) from public, anon, authenticated;
