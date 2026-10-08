-- Food OS tenant-scoped SaaS entitlement contract.
create table if not exists public.food_os_entitlements (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null unique references public.assurance_organizations(id) on delete cascade,
 plan_key text not null default 'trial' check(plan_key in('trial','professional','business','enterprise')),
 status text not null default 'trialing' check(status in('trialing','active','past_due','canceled','expired')),
 stripe_customer_id text,
 stripe_subscription_id text unique,
 period_start timestamptz,
 period_end timestamptz,
 trial_end timestamptz,
 user_limit int,
 facility_limit int,
 modules jsonb not null default '["traceability","recall","capa","evidence","readiness","exports"]'::jsonb,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
alter table public.food_os_entitlements enable row level security;
drop policy if exists food_os_entitlements_select on public.food_os_entitlements;
create policy food_os_entitlements_select on public.food_os_entitlements
 for select to authenticated using(public.is_assurance_member(organization_id));
grant select on public.food_os_entitlements to authenticated;
create index if not exists food_os_entitlements_subscription_idx on public.food_os_entitlements(stripe_subscription_id);
create or replace function public.food_os_has_entitlement(p_org uuid)
returns boolean language sql security invoker stable set search_path='' as $$
 select public.is_assurance_member(p_org)
 and exists(select 1 from public.food_os_entitlements e where e.organization_id=p_org
 and e.status in('trialing','active')
 and (e.period_end is null or e.period_end>now())
 and (e.trial_end is null or e.trial_end>now()))
$$;
grant execute on function public.food_os_has_entitlement(uuid) to authenticated;
