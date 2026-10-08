-- Active paid subscriptions must not be denied by an expired historic trial_end.
create or replace function public.food_os_has_entitlement(p_org uuid)
returns boolean language sql security invoker stable set search_path='' as $$
 select public.is_assurance_member(p_org) and exists (
 select 1 from public.food_os_entitlements e
 where e.organization_id=p_org and
 ((e.status='active' and (e.period_end is null or e.period_end>now()))
 or (e.status='trialing' and (e.trial_end is null or e.trial_end>now()) and (e.period_end is null or e.period_end>now())))
 )
$$;
grant execute on function public.food_os_has_entitlement(uuid) to authenticated;
