
create table if not exists public.creator_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 months'),
  active boolean not null default true,
  unique (referred_user_id)
);

create index if not exists creator_referrals_referrer_idx
  on public.creator_referrals(referrer_user_id);

grant select on public.creator_referrals to authenticated;
grant all on public.creator_referrals to service_role;

alter table public.creator_referrals enable row level security;

drop policy if exists "creator_referrals: read own" on public.creator_referrals;
create policy "creator_referrals: read own"
on public.creator_referrals
for select
to authenticated
using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

create or replace function public.record_creator_referral(_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _referrer uuid;
begin
  if _uid is null or _code is null or length(_code) < 6 then
    return false;
  end if;

  select id into _referrer
  from auth.users
  where upper(replace(id::text, '-', '')) like upper(_code) || '%'
  limit 1;

  if _referrer is null or _referrer = _uid then
    return false;
  end if;

  insert into public.creator_referrals (referrer_user_id, referred_user_id, code)
  values (_referrer, _uid, upper(_code))
  on conflict (referred_user_id) do nothing;

  return true;
end;
$$;

grant execute on function public.record_creator_referral(text) to authenticated;

create or replace function public.get_creator_referral_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _referred_count int := 0;
  _active_count int := 0;
  _gmv_cents bigint := 0;
  _bonus_cents bigint := 0;
begin
  if _uid is null then
    return jsonb_build_object('referred_count', 0, 'active_count', 0, 'gmv_cents', 0, 'bonus_cents', 0);
  end if;

  select count(*) into _referred_count
  from public.creator_referrals
  where referrer_user_id = _uid;

  select count(*) into _active_count
  from public.creator_referrals
  where referrer_user_id = _uid and active and expires_at > now();

  select coalesce(sum(oi.unit_price_cents * oi.quantity), 0)
    into _gmv_cents
  from public.creator_referrals r
  join public.order_items oi on oi.seller_id = r.referred_user_id
  join public.orders o on o.id = oi.order_id
  where r.referrer_user_id = _uid
    and o.created_at between r.created_at and r.expires_at
    and o.status in ('paid', 'completed', 'fulfilled');

  _bonus_cents := floor(_gmv_cents * 0.05);

  return jsonb_build_object(
    'referred_count', _referred_count,
    'active_count', _active_count,
    'gmv_cents', _gmv_cents,
    'bonus_cents', _bonus_cents
  );
end;
$$;

grant execute on function public.get_creator_referral_stats() to authenticated;
