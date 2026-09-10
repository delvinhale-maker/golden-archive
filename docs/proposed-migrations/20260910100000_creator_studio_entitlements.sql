-- AurumVault Creator Studio — CS4 entitlements and usage
-- PROPOSAL ONLY. Apply first to isolated staging in CS5.

create table if not exists public.creator_studio_entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null default 'FREE' check (plan_key in ('FREE','PRO','BUSINESS')),
  included_videos integer not null default 1 check (included_videos >= 0),
  period_start timestamptz,
  period_end timestamptz,
  source text not null default 'SYSTEM' check (source in ('SYSTEM','STRIPE','ADMIN')),
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table if not exists public.creator_studio_extra_credits (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  remaining integer not null check (remaining >= 0 and remaining <= quantity),
  source_reference text not null,
  created_at timestamptz not null default now(),
  unique (source_reference)
);

create table if not exists public.creator_studio_usage (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  render_job_id uuid references public.creator_studio_render_jobs(id) on delete set null,
  idempotency_key text not null,
  usage_type text not null check (usage_type in ('FREE_PREVIEW','INCLUDED','EXTRA')),
  status text not null default 'RESERVED' check (status in ('RESERVED','CONSUMED','RELEASED')),
  period_key text not null,
  extra_credit_id uuid references public.creator_studio_extra_credits(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, idempotency_key)
);

create index if not exists creator_studio_usage_owner_period_idx on public.creator_studio_usage(owner_user_id, period_key, status);
create index if not exists creator_studio_extra_credits_owner_idx on public.creator_studio_extra_credits(owner_user_id, created_at);

alter table public.creator_studio_entitlements enable row level security;
alter table public.creator_studio_extra_credits enable row level security;
alter table public.creator_studio_usage enable row level security;

create policy creator_studio_entitlements_owner_read on public.creator_studio_entitlements
  for select to authenticated using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy creator_studio_extra_credits_owner_read on public.creator_studio_extra_credits
  for select to authenticated using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy creator_studio_usage_owner_read on public.creator_studio_usage
  for select to authenticated using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Entitlements, purchased credits, and usage are trusted-server managed.
revoke insert, update, delete on table public.creator_studio_entitlements from anon, authenticated;
revoke insert, update, delete on table public.creator_studio_extra_credits from anon, authenticated;
revoke insert, update, delete on table public.creator_studio_usage from anon, authenticated;

create or replace function public.creator_studio_reserve_video(p_owner_user_id uuid, p_idempotency_key text)
returns table (usage_id uuid, usage_type text, period_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ent public.creator_studio_entitlements%rowtype;
  v_period_key text;
  v_used integer;
  v_usage_type text;
  v_extra public.creator_studio_extra_credits%rowtype;
  v_usage_id uuid;
begin
  if auth.uid() is distinct from p_owner_user_id and not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized';
  end if;

  select * into v_ent from public.creator_studio_entitlements where owner_user_id = p_owner_user_id for update;
  if not found then
    insert into public.creator_studio_entitlements(owner_user_id, plan_key, included_videos, source)
    values (p_owner_user_id, 'FREE', 1, 'SYSTEM')
    returning * into v_ent;
  end if;

  if v_ent.plan_key = 'FREE' then
    v_period_key := 'LIFETIME';
  else
    v_period_key := coalesce(to_char(v_ent.period_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), to_char(date_trunc('month', now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  end if;

  select u.id, u.usage_type, u.period_key into v_usage_id, v_usage_type, v_period_key
  from public.creator_studio_usage u
  where u.owner_user_id = p_owner_user_id and u.idempotency_key = p_idempotency_key;
  if found then
    return query select v_usage_id, v_usage_type, v_period_key;
    return;
  end if;

  select count(*) into v_used from public.creator_studio_usage u
  where u.owner_user_id = p_owner_user_id and u.period_key = v_period_key and u.status in ('RESERVED','CONSUMED') and u.usage_type in ('FREE_PREVIEW','INCLUDED');

  if v_used < v_ent.included_videos then
    v_usage_type := case when v_ent.plan_key = 'FREE' then 'FREE_PREVIEW' else 'INCLUDED' end;
  else
    select * into v_extra from public.creator_studio_extra_credits
    where owner_user_id = p_owner_user_id and remaining > 0
    order by created_at asc
    limit 1 for update;
    if not found then
      raise exception 'creator_studio_quota_exceeded';
    end if;
    update public.creator_studio_extra_credits set remaining = remaining - 1 where id = v_extra.id;
    v_usage_type := 'EXTRA';
  end if;

  insert into public.creator_studio_usage(owner_user_id,idempotency_key,usage_type,status,period_key,extra_credit_id)
  values (p_owner_user_id,p_idempotency_key,v_usage_type,'RESERVED',v_period_key,case when v_usage_type='EXTRA' then v_extra.id else null end)
  returning id into v_usage_id;

  return query select v_usage_id, v_usage_type, v_period_key;
end;
$$;

create or replace function public.creator_studio_finalize_video(p_owner_user_id uuid, p_idempotency_key text, p_success boolean, p_render_job_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage public.creator_studio_usage%rowtype;
begin
  if auth.uid() is distinct from p_owner_user_id and not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized';
  end if;
  select * into v_usage from public.creator_studio_usage where owner_user_id=p_owner_user_id and idempotency_key=p_idempotency_key for update;
  if not found or v_usage.status <> 'RESERVED' then return; end if;
  if p_success then
    update public.creator_studio_usage set status='CONSUMED', render_job_id=p_render_job_id, updated_at=now() where id=v_usage.id;
  else
    update public.creator_studio_usage set status='RELEASED', render_job_id=p_render_job_id, updated_at=now() where id=v_usage.id;
    if v_usage.usage_type='EXTRA' and v_usage.extra_credit_id is not null then
      update public.creator_studio_extra_credits set remaining=remaining+1 where id=v_usage.extra_credit_id;
    end if;
  end if;
end;
$$;

revoke all on function public.creator_studio_reserve_video(uuid,text) from public, anon;
grant execute on function public.creator_studio_reserve_video(uuid,text) to authenticated, service_role;
revoke all on function public.creator_studio_finalize_video(uuid,text,boolean,uuid) from public, anon;
grant execute on function public.creator_studio_finalize_video(uuid,text,boolean,uuid) to authenticated, service_role;
