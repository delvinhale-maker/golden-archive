-- Creator Studio CS4: server-enforced entitlements and atomic usage accounting.
-- Stripe remains the platform billing source; these tables are the Creator Studio
-- entitlement/usage projection used to decide whether a video may be generated.

create table if not exists public.creator_studio_entitlements (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  plan_key text not null default 'FREE' check (plan_key in ('FREE','CREATOR_PRO','CREATOR_BUSINESS')),
  billing_status text not null default 'FREE' check (billing_status in ('FREE','PENDING','ACTIVE','PAST_DUE','CANCELED')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((plan_key='FREE' and billing_status='FREE') or plan_key<>'FREE' or billing_status='FREE'),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);

create table if not exists public.creator_studio_billing_state (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_environment text not null check (stripe_environment in ('sandbox','live')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  last_event_created timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_environment, stripe_subscription_id)
);

create table if not exists public.creator_studio_extra_video_credits (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  stripe_environment text not null check (stripe_environment in ('sandbox','live')),
  stripe_checkout_session_id text not null,
  quantity_purchased integer not null check (quantity_purchased between 1 and 100),
  quantity_remaining integer not null check (quantity_remaining between 0 and quantity_purchased),
  created_at timestamptz not null default now(),
  unique (stripe_environment, stripe_checkout_session_id)
);

create table if not exists public.creator_studio_usage_reservations (
  id uuid primary key default gen_random_uuid(),
  render_job_id uuid not null unique references public.creator_studio_render_jobs(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('FREE_PREVIEW','PLAN_INCLUDED','EXTRA_CREDIT')),
  state text not null default 'RESERVED' check (state in ('RESERVED','CONSUMED','RELEASED')),
  plan_key text not null check (plan_key in ('FREE','CREATOR_PRO','CREATOR_BUSINESS')),
  period_start timestamptz,
  period_end timestamptz,
  extra_credit_id uuid references public.creator_studio_extra_video_credits(id) on delete restrict,
  reserved_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  check ((source='EXTRA_CREDIT' and extra_credit_id is not null) or (source<>'EXTRA_CREDIT' and extra_credit_id is null)),
  check ((source='PLAN_INCLUDED' and period_start is not null and period_end is not null) or source<>'PLAN_INCLUDED')
);

create table if not exists public.creator_studio_stripe_events (
  stripe_environment text not null check (stripe_environment in ('sandbox','live')),
  stripe_event_id text not null,
  event_type text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  event_created timestamptz not null,
  processed_at timestamptz not null default now(),
  primary key (stripe_environment, stripe_event_id)
);

create index if not exists creator_studio_usage_owner_state_idx
  on public.creator_studio_usage_reservations(owner_user_id,state,reserved_at desc);
create index if not exists creator_studio_usage_period_idx
  on public.creator_studio_usage_reservations(owner_user_id,source,period_start,state);
create index if not exists creator_studio_extra_credit_owner_idx
  on public.creator_studio_extra_video_credits(owner_user_id,quantity_remaining,created_at);
create index if not exists creator_studio_stripe_events_owner_idx
  on public.creator_studio_stripe_events(owner_user_id,processed_at desc);

alter table public.creator_studio_entitlements enable row level security;
alter table public.creator_studio_billing_state enable row level security;
alter table public.creator_studio_extra_video_credits enable row level security;
alter table public.creator_studio_usage_reservations enable row level security;
alter table public.creator_studio_stripe_events enable row level security;

revoke all on public.creator_studio_entitlements from public, anon, authenticated;
revoke all on public.creator_studio_billing_state from public, anon, authenticated;
revoke all on public.creator_studio_extra_video_credits from public, anon, authenticated;
revoke all on public.creator_studio_usage_reservations from public, anon, authenticated;
revoke all on public.creator_studio_stripe_events from public, anon, authenticated;

grant select on public.creator_studio_entitlements to authenticated;
grant select on public.creator_studio_usage_reservations to authenticated;

create policy creator_studio_entitlements_owner_select
  on public.creator_studio_entitlements for select to authenticated
  using (owner_user_id=(select auth.uid()) or public.has_role((select auth.uid()),'admin'));
create policy creator_studio_usage_owner_select
  on public.creator_studio_usage_reservations for select to authenticated
  using (owner_user_id=(select auth.uid()) or public.has_role((select auth.uid()),'admin'));

create or replace function public.creator_studio_server_reserve_entitled_render_job(
  _actor_user_id uuid,
  _project_id uuid,
  _idempotency_key text,
  _template_version text
)
returns table(render_job_id uuid, quality text, usage_source text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing public.creator_studio_render_jobs%rowtype;
  v_existing_source text;
  v_project public.creator_studio_projects%rowtype;
  v_control public.creator_studio_runtime_control%rowtype;
  v_ent public.creator_studio_entitlements%rowtype;
  v_active integer;
  v_used integer;
  v_attempts integer;
  v_allowance integer;
  v_estimated integer;
  v_job uuid;
  v_quality text;
  v_source text;
  v_credit_id uuid;
begin
  if _actor_user_id is null then raise exception 'creator_studio_actor_required'; end if;
  if char_length(_idempotency_key) < 16 or char_length(_idempotency_key) > 128 then
    raise exception 'creator_studio_idempotency_invalid';
  end if;

  select j.* into v_existing
  from public.creator_studio_render_jobs j
  where j.owner_user_id=_actor_user_id and j.idempotency_key=_idempotency_key;
  if v_existing.id is not null then
    select u.source into v_existing_source from public.creator_studio_usage_reservations u where u.render_job_id=v_existing.id;
    return query select v_existing.id, v_existing.quality, coalesce(v_existing_source,'LEGACY');
    return;
  end if;

  select * into v_control from public.creator_studio_runtime_control where singleton for update;
  if not v_control.rendering_enabled then raise exception 'creator_studio_rendering_disabled'; end if;
  if v_control.circuit_open_until is not null and v_control.circuit_open_until > now() then
    raise exception 'creator_studio_provider_circuit_open';
  end if;

  select * into v_project from public.creator_studio_projects where id=_project_id for update;
  if v_project.id is null or v_project.owner_user_id<>_actor_user_id then
    raise exception 'creator_studio_project_not_found';
  end if;
  if v_project.status<>'READY' then raise exception 'creator_studio_project_not_ready'; end if;

  insert into public.creator_studio_entitlements(owner_user_id)
  values(_actor_user_id)
  on conflict (owner_user_id) do nothing;
  select * into v_ent from public.creator_studio_entitlements where owner_user_id=_actor_user_id for update;

  -- Recheck after acquiring the entitlement lock so two simultaneous requests
  -- with the same key collapse to one job rather than racing the unique index.
  select j.* into v_existing
  from public.creator_studio_render_jobs j
  where j.owner_user_id=_actor_user_id and j.idempotency_key=_idempotency_key;
  if v_existing.id is not null then
    select u.source into v_existing_source from public.creator_studio_usage_reservations u where u.render_job_id=v_existing.id;
    return query select v_existing.id, v_existing.quality, coalesce(v_existing_source,'LEGACY');
    return;
  end if;

  select count(*) into v_active
  from public.creator_studio_render_jobs
  where owner_user_id=_actor_user_id and status in ('QUEUED','SUBMITTED','RENDERING');
  if v_active >= v_control.max_concurrent_per_user then raise exception 'creator_studio_render_concurrency_limit'; end if;

  if v_ent.plan_key in ('CREATOR_PRO','CREATOR_BUSINESS')
     and v_ent.billing_status='ACTIVE'
     and v_ent.current_period_start is not null
     and v_ent.current_period_end is not null
     and now() >= v_ent.current_period_start
     and now() < v_ent.current_period_end then
    v_allowance := case v_ent.plan_key when 'CREATOR_PRO' then 10 else 50 end;
    select count(*) into v_used
    from public.creator_studio_usage_reservations
    where owner_user_id=_actor_user_id
      and source='PLAN_INCLUDED'
      and period_start=v_ent.current_period_start
      and state in ('RESERVED','CONSUMED');
    if v_used < v_allowance then
      v_quality := 'STANDARD';
      v_source := 'PLAN_INCLUDED';
    end if;
  end if;

  if v_source is null then
    select id into v_credit_id
    from public.creator_studio_extra_video_credits
    where owner_user_id=_actor_user_id and quantity_remaining>0
    order by created_at,id
    limit 1
    for update;
    if v_credit_id is not null then
      update public.creator_studio_extra_video_credits
      set quantity_remaining=quantity_remaining-1
      where id=v_credit_id;
      v_quality := 'STANDARD';
      v_source := 'EXTRA_CREDIT';
    end if;
  end if;

  if v_source is null then
    select count(*) into v_used
    from public.creator_studio_usage_reservations
    where owner_user_id=_actor_user_id and source='FREE_PREVIEW' and state in ('RESERVED','CONSUMED');
    if v_used=0 then
      select count(*) into v_attempts
      from public.creator_studio_usage_reservations
      where owner_user_id=_actor_user_id and source='FREE_PREVIEW' and reserved_at > now()-interval '24 hours';
      if v_attempts >= 3 then raise exception 'creator_studio_free_preview_rate_limit'; end if;
      v_quality := 'PREVIEW';
      v_source := 'FREE_PREVIEW';
    end if;
  end if;

  if v_source is null then raise exception 'creator_studio_video_allowance_exhausted'; end if;

  v_estimated := ceil(v_project.duration_seconds::numeric/60.0*v_control.estimated_cost_cents_per_minute);
  insert into public.creator_studio_render_jobs(
    project_id,owner_user_id,template_version,quality,requested_duration_seconds,
    estimated_cost_cents,idempotency_key,timeout_at
  ) values(
    v_project.id,_actor_user_id,_template_version,v_quality,v_project.duration_seconds,
    v_estimated,_idempotency_key,now()+make_interval(secs=>v_control.timeout_seconds)
  ) returning id into v_job;

  insert into public.creator_studio_usage_reservations(
    render_job_id,owner_user_id,source,plan_key,period_start,period_end,extra_credit_id
  ) values(
    v_job,_actor_user_id,v_source,
    case when v_source='PLAN_INCLUDED' then v_ent.plan_key else 'FREE' end,
    case when v_source='PLAN_INCLUDED' then v_ent.current_period_start else null end,
    case when v_source='PLAN_INCLUDED' then v_ent.current_period_end else null end,
    v_credit_id
  );

  insert into public.creator_studio_events(owner_user_id,project_id,event_type,entity_id,metadata)
  values(_actor_user_id,_project_id,'RENDER_RESERVED',v_job,
    jsonb_build_object('quality',v_quality,'usage_source',v_source,'estimated_cost_cents',v_estimated));

  return query select v_job,v_quality,v_source;
end;
$$;

create or replace function public.creator_studio_server_settle_usage_from_job()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare v_usage public.creator_studio_usage_reservations%rowtype;
begin
  if old.status is not distinct from new.status or new.status not in ('SUCCEEDED','FAILED','CANCELLED') then return new; end if;
  select * into v_usage from public.creator_studio_usage_reservations where render_job_id=new.id for update;
  if v_usage.id is null or v_usage.state<>'RESERVED' then return new; end if;

  if new.status='SUCCEEDED' then
    update public.creator_studio_usage_reservations
    set state='CONSUMED',consumed_at=now(),released_at=null
    where id=v_usage.id and state='RESERVED';
  else
    update public.creator_studio_usage_reservations
    set state='RELEASED',released_at=now(),consumed_at=null
    where id=v_usage.id and state='RESERVED';
    if v_usage.source='EXTRA_CREDIT' and v_usage.extra_credit_id is not null then
      update public.creator_studio_extra_video_credits
      set quantity_remaining=least(quantity_purchased,quantity_remaining+1)
      where id=v_usage.extra_credit_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists creator_studio_render_usage_settlement on public.creator_studio_render_jobs;
create trigger creator_studio_render_usage_settlement
after update of status on public.creator_studio_render_jobs
for each row execute function public.creator_studio_server_settle_usage_from_job();

-- Webhook-only subscription projection. Actual Stripe price verification is
-- performed server-side before this function is called.
create or replace function public.creator_studio_server_apply_subscription_event(
  _owner_user_id uuid,
  _stripe_environment text,
  _stripe_event_id text,
  _event_type text,
  _event_created timestamptz,
  _stripe_customer_id text,
  _stripe_subscription_id text,
  _stripe_price_id text,
  _plan_key text,
  _billing_status text,
  _period_start timestamptz,
  _period_end timestamptz,
  _cancel_at_period_end boolean
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare v_inserted integer; v_last timestamptz;
begin
  if _stripe_environment not in ('sandbox','live') then raise exception 'creator_studio_stripe_environment_invalid'; end if;
  if _plan_key not in ('CREATOR_PRO','CREATOR_BUSINESS') then raise exception 'creator_studio_plan_invalid'; end if;
  if _billing_status not in ('PENDING','ACTIVE','PAST_DUE','CANCELED') then raise exception 'creator_studio_billing_status_invalid'; end if;
  if _period_end is not null and _period_start is not null and _period_end<=_period_start then raise exception 'creator_studio_period_invalid'; end if;

  insert into public.creator_studio_stripe_events(stripe_environment,stripe_event_id,event_type,owner_user_id,event_created)
  values(_stripe_environment,_stripe_event_id,left(_event_type,100),_owner_user_id,_event_created)
  on conflict do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then return false; end if;

  select last_event_created into v_last from public.creator_studio_billing_state where owner_user_id=_owner_user_id for update;
  if v_last is not null and _event_created < v_last then return true; end if;

  insert into public.creator_studio_billing_state(
    owner_user_id,stripe_environment,stripe_customer_id,stripe_subscription_id,stripe_price_id,last_event_created
  ) values(
    _owner_user_id,_stripe_environment,_stripe_customer_id,_stripe_subscription_id,_stripe_price_id,_event_created
  ) on conflict(owner_user_id) do update set
    stripe_environment=excluded.stripe_environment,
    stripe_customer_id=excluded.stripe_customer_id,
    stripe_subscription_id=excluded.stripe_subscription_id,
    stripe_price_id=excluded.stripe_price_id,
    last_event_created=excluded.last_event_created,
    updated_at=now();

  insert into public.creator_studio_entitlements(
    owner_user_id,plan_key,billing_status,current_period_start,current_period_end,cancel_at_period_end
  ) values(
    _owner_user_id,_plan_key,_billing_status,_period_start,_period_end,_cancel_at_period_end
  ) on conflict(owner_user_id) do update set
    plan_key=excluded.plan_key,
    billing_status=excluded.billing_status,
    current_period_start=excluded.current_period_start,
    current_period_end=excluded.current_period_end,
    cancel_at_period_end=excluded.cancel_at_period_end,
    updated_at=now();
  return true;
end;
$$;

create or replace function public.creator_studio_server_grant_extra_video_event(
  _owner_user_id uuid,
  _stripe_environment text,
  _stripe_event_id text,
  _event_type text,
  _event_created timestamptz,
  _stripe_checkout_session_id text,
  _quantity integer
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare v_inserted integer;
begin
  if _stripe_environment not in ('sandbox','live') then raise exception 'creator_studio_stripe_environment_invalid'; end if;
  if _quantity<1 or _quantity>100 then raise exception 'creator_studio_extra_quantity_invalid'; end if;
  insert into public.creator_studio_stripe_events(stripe_environment,stripe_event_id,event_type,owner_user_id,event_created)
  values(_stripe_environment,_stripe_event_id,left(_event_type,100),_owner_user_id,_event_created)
  on conflict do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then return false; end if;

  insert into public.creator_studio_extra_video_credits(
    owner_user_id,stripe_environment,stripe_checkout_session_id,quantity_purchased,quantity_remaining
  ) values(_owner_user_id,_stripe_environment,_stripe_checkout_session_id,_quantity,_quantity)
  on conflict(stripe_environment,stripe_checkout_session_id) do nothing;
  return true;
end;
$$;

-- The CS3 reservation function accepted quality explicitly. Keep the definition
-- for migration compatibility, but remove all grants so server code cannot use
-- it accidentally after CS4.
revoke all on function public.creator_studio_server_reserve_render_job(uuid,uuid,text,text,text)
  from public,anon,authenticated,service_role;

revoke all on function public.creator_studio_server_reserve_entitled_render_job(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.creator_studio_server_reserve_entitled_render_job(uuid,uuid,text,text) to service_role;
revoke all on function public.creator_studio_server_apply_subscription_event(uuid,text,text,text,timestamptz,text,text,text,text,text,timestamptz,timestamptz,boolean)
  from public,anon,authenticated;
grant execute on function public.creator_studio_server_apply_subscription_event(uuid,text,text,text,timestamptz,text,text,text,text,text,timestamptz,timestamptz,boolean) to service_role;
revoke all on function public.creator_studio_server_grant_extra_video_event(uuid,text,text,text,timestamptz,text,integer)
  from public,anon,authenticated;
grant execute on function public.creator_studio_server_grant_extra_video_event(uuid,text,text,text,timestamptz,text,integer) to service_role;
revoke all on function public.creator_studio_server_settle_usage_from_job() from public,anon,authenticated;
