-- Agent Authority transactional daily-spend reservations.
-- Purpose: serialize concurrent purchase authorization against a Passport's UTC daily cap,
-- preserve idempotency by Action Request, and bind execution truth to an active reservation.

create table if not exists public.agent_daily_spend_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.agent_authority_workspaces(id) on delete cascade,
  passport_id uuid not null references public.agent_passports(id) on delete cascade,
  passport_version integer not null check (passport_version > 0),
  action_request_id uuid not null unique references public.action_requests(id) on delete cascade,
  spend_date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'RESERVED' check (status in ('RESERVED','COMMITTED','RELEASED')),
  reservation_expires_at timestamptz not null,
  reserved_at timestamptz not null default now(),
  committed_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.agent_daily_spend_reservations is
  'Server-only UTC daily-spend reservations. RESERVED amounts count against the cap until execution, release, or UTC-day expiry.';

create index if not exists idx_agent_daily_spend_reservations_bucket
  on public.agent_daily_spend_reservations(workspace_id, passport_id, spend_date, currency, status, reservation_expires_at);

alter table public.agent_daily_spend_reservations enable row level security;
revoke all on table public.agent_daily_spend_reservations from public, anon, authenticated;
grant select, insert, update on table public.agent_daily_spend_reservations to service_role;

create or replace function public.reserve_agent_daily_spend(
  p_workspace_id uuid,
  p_action_request_id uuid
)
returns table(
  accepted boolean,
  reservation_id uuid,
  committed_amount numeric,
  reserved_amount numeric,
  projected_amount numeric,
  reservation_expires_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.action_requests%rowtype;
  v_limits public.agent_limits%rowtype;
  v_existing public.agent_daily_spend_reservations%rowtype;
  v_now timestamptz := clock_timestamp();
  v_spend_date date;
  v_currency text;
  v_expires_at timestamptz;
  v_committed numeric(14,2) := 0;
  v_reserved numeric(14,2) := 0;
  v_projected numeric(14,2) := 0;
  v_reservation_id uuid;
begin
  select ar.* into v_request
  from public.action_requests as ar
  where ar.id = p_action_request_id
    and ar.workspace_id = p_workspace_id
  for share;

  if not found then
    raise exception 'DAILY_SPEND_ACTION_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_request.amount_kind <> 'PURCHASE' or v_request.amount is null then
    raise exception 'DAILY_SPEND_PURCHASE_REQUEST_REQUIRED' using errcode = '22023';
  end if;

  select al.* into v_limits
  from public.agent_limits as al
  where al.workspace_id = v_request.workspace_id
    and al.passport_id = v_request.passport_id
    and al.passport_version = v_request.passport_version
  for share;

  if not found then
    raise exception 'DAILY_SPEND_LIMITS_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_currency := upper(coalesce(v_request.currency, v_limits.currency));
  if v_currency <> upper(v_limits.currency) then
    raise exception 'DAILY_SPEND_CURRENCY_MISMATCH' using errcode = '23514';
  end if;

  if v_limits.max_daily_spend is null then
    return query select true, null::uuid, 0::numeric, 0::numeric, v_request.amount, null::timestamptz;
    return;
  end if;

  v_spend_date := (v_request.requested_at at time zone 'UTC')::date;
  v_expires_at := ((v_spend_date + 1)::timestamp at time zone 'UTC');
  if v_expires_at <= v_now then
    raise exception 'DAILY_SPEND_WINDOW_EXPIRED' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'agent-authority-daily-spend:' || p_workspace_id::text || ':' || v_request.passport_id::text || ':' || v_spend_date::text || ':' || v_currency,
      0
    )
  );

  select dsr.* into v_existing
  from public.agent_daily_spend_reservations as dsr
  where dsr.action_request_id = v_request.id
  for update;

  update public.agent_daily_spend_reservations as dsr
  set status = 'RELEASED', released_at = coalesce(dsr.released_at, v_now), updated_at = v_now
  where dsr.workspace_id = v_request.workspace_id
    and dsr.passport_id = v_request.passport_id
    and dsr.spend_date = v_spend_date
    and dsr.currency = v_currency
    and dsr.status = 'RESERVED'
    and dsr.reservation_expires_at <= v_now;

  select
    coalesce(sum(case when dsr.status = 'COMMITTED' then dsr.amount else 0 end), 0),
    coalesce(sum(case when dsr.status = 'RESERVED' and dsr.reservation_expires_at > v_now then dsr.amount else 0 end), 0)
  into v_committed, v_reserved
  from public.agent_daily_spend_reservations as dsr
  where dsr.workspace_id = v_request.workspace_id
    and dsr.passport_id = v_request.passport_id
    and dsr.spend_date = v_spend_date
    and dsr.currency = v_currency;

  if found and v_existing.id is not null then
    return query select
      (v_existing.status = 'COMMITTED' or (v_existing.status = 'RESERVED' and v_existing.reservation_expires_at > v_now)),
      v_existing.id,
      v_committed,
      v_reserved,
      (v_committed + v_reserved),
      v_existing.reservation_expires_at;
    return;
  end if;

  v_projected := v_committed + v_reserved + v_request.amount;
  if v_projected > v_limits.max_daily_spend then
    return query select false, null::uuid, v_committed, v_reserved, v_projected, v_expires_at;
    return;
  end if;

  insert into public.agent_daily_spend_reservations(
    workspace_id, passport_id, passport_version, action_request_id,
    spend_date, currency, amount, status, reservation_expires_at
  ) values (
    v_request.workspace_id, v_request.passport_id, v_request.passport_version, v_request.id,
    v_spend_date, v_currency, v_request.amount, 'RESERVED', v_expires_at
  )
  returning id into v_reservation_id;

  return query select true, v_reservation_id, v_committed, v_reserved, v_projected, v_expires_at;
end;
$$;

revoke all on function public.reserve_agent_daily_spend(uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_agent_daily_spend(uuid,uuid) to service_role;

create or replace function public.enforce_agent_authority_receipt_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_request public.action_requests%rowtype;
  v_decision public.action_decisions%rowtype;
  v_passport public.agent_passports%rowtype;
  v_approval public.approval_requests%rowtype;
  v_limits public.agent_limits%rowtype;
  v_spend public.agent_daily_spend_reservations%rowtype;
begin
  select ar.* into v_request
  from public.action_requests as ar
  where ar.id = new.action_request_id;
  if not found then
    raise exception 'RECEIPT_ACTION_REQUEST_NOT_FOUND' using errcode = '23503';
  end if;

  select ad.* into v_decision
  from public.action_decisions as ad
  where ad.id = new.decision_id;
  if not found then
    raise exception 'RECEIPT_DECISION_NOT_FOUND' using errcode = '23503';
  end if;

  if v_decision.action_request_id <> v_request.id
     or new.workspace_id <> v_request.workspace_id
     or new.workspace_id <> v_decision.workspace_id
     or new.passport_id <> v_request.passport_id
     or new.passport_id <> v_decision.passport_id
     or new.passport_version <> v_request.passport_version
     or new.passport_version <> v_decision.passport_version
     or new.policy_version <> v_decision.policy_version
     or new.policy_code <> v_decision.policy_code
     or new.action_key <> v_request.action_key
     or new.authority_result <> v_decision.decision then
    raise exception 'RECEIPT_POLICY_CONTEXT_MISMATCH' using errcode = '23514';
  end if;

  if new.requested_at <> v_request.requested_at then
    raise exception 'RECEIPT_REQUEST_TIMESTAMP_MISMATCH' using errcode = '23514';
  end if;

  if new.receipt_kind = 'EXECUTION' then
    select ap.* into v_passport
    from public.agent_passports as ap
    where ap.id = new.passport_id
      and ap.workspace_id = new.workspace_id
    for share;

    if not found then
      raise exception 'EXECUTION_PASSPORT_NOT_FOUND' using errcode = '23503';
    end if;

    if v_passport.status <> 'AUTHORIZED' or v_passport.authorized_at is null then
      raise exception 'EXECUTION_PASSPORT_NOT_AUTHORIZED' using errcode = '23514';
    end if;

    if v_passport.authorization_expires_at is not null
       and v_passport.authorization_expires_at <= now() then
      raise exception 'EXECUTION_PASSPORT_AUTHORIZATION_EXPIRED' using errcode = '23514';
    end if;

    if v_passport.current_version <> v_decision.passport_version then
      raise exception 'EXECUTION_POLICY_VERSION_STALE' using errcode = '23514';
    end if;

    if v_decision.decision = 'BLOCK' then
      raise exception 'EXECUTION_BLOCKED_BY_POLICY' using errcode = '23514';
    end if;

    if v_decision.decision = 'APPROVAL_REQUIRED' then
      select apr.* into v_approval
      from public.approval_requests as apr
      where apr.action_request_id = v_request.id
      for share;

      if not found or v_approval.status <> 'APPROVED' then
        raise exception 'EXECUTION_APPROVAL_REQUIRED' using errcode = '23514';
      end if;
    end if;

    if v_request.amount_kind = 'PURCHASE' and v_request.amount is not null then
      select al.* into v_limits
      from public.agent_limits as al
      where al.workspace_id = v_request.workspace_id
        and al.passport_id = v_request.passport_id
        and al.passport_version = v_request.passport_version
      for share;

      if not found then
        raise exception 'EXECUTION_LIMITS_NOT_FOUND' using errcode = '23503';
      end if;

      if v_limits.max_daily_spend is not null then
        select dsr.* into v_spend
        from public.agent_daily_spend_reservations as dsr
        where dsr.action_request_id = v_request.id
        for update;

        if not found then
          raise exception 'EXECUTION_DAILY_SPEND_RESERVATION_REQUIRED' using errcode = '23514';
        end if;
        if v_spend.status <> 'RESERVED' then
          raise exception 'EXECUTION_DAILY_SPEND_RESERVATION_NOT_ACTIVE' using errcode = '23514';
        end if;
        if v_spend.reservation_expires_at <= now() then
          raise exception 'EXECUTION_DAILY_SPEND_RESERVATION_EXPIRED' using errcode = '23514';
        end if;
        if v_spend.amount <> v_request.amount
           or v_spend.currency <> upper(coalesce(v_request.currency, v_limits.currency)) then
          raise exception 'EXECUTION_DAILY_SPEND_RESERVATION_MISMATCH' using errcode = '23514';
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.settle_agent_daily_spend_from_receipt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.receipt_kind = 'EXECUTION' and new.execution_status = 'EXECUTED' then
    update public.agent_daily_spend_reservations
    set status = 'COMMITTED', committed_at = coalesce(committed_at, new.executed_at, now()), updated_at = now()
    where action_request_id = new.action_request_id and status = 'RESERVED';
  elsif new.receipt_kind = 'EXECUTION' and new.execution_status in ('FAILED','CANCELLED') then
    update public.agent_daily_spend_reservations
    set status = 'RELEASED', released_at = coalesce(released_at, now()), updated_at = now()
    where action_request_id = new.action_request_id and status = 'RESERVED';
  elsif new.receipt_kind = 'TERMINAL' then
    update public.agent_daily_spend_reservations
    set status = 'RELEASED', released_at = coalesce(released_at, now()), updated_at = now()
    where action_request_id = new.action_request_id and status = 'RESERVED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_settle_agent_daily_spend_from_receipt on public.authorization_receipts;
create trigger trg_settle_agent_daily_spend_from_receipt
after insert on public.authorization_receipts
for each row execute function public.settle_agent_daily_spend_from_receipt();
