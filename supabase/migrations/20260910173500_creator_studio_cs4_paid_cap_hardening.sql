-- Active paid plans must not fall through to the Free preview after exhausting
-- their included allowance. Extra credits are the only paid-plan overflow.
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
  v_active_paid boolean := false;
begin
  if _actor_user_id is null then raise exception 'creator_studio_actor_required'; end if;
  if char_length(_idempotency_key) < 16 or char_length(_idempotency_key) > 128 then raise exception 'creator_studio_idempotency_invalid'; end if;

  select j.* into v_existing from public.creator_studio_render_jobs j
  where j.owner_user_id=_actor_user_id and j.idempotency_key=_idempotency_key;
  if v_existing.id is not null then
    select u.source into v_existing_source from public.creator_studio_usage_reservations u where u.render_job_id=v_existing.id;
    return query select v_existing.id,v_existing.quality,coalesce(v_existing_source,'LEGACY');
    return;
  end if;

  select * into v_control from public.creator_studio_runtime_control where singleton for update;
  if not v_control.rendering_enabled then raise exception 'creator_studio_rendering_disabled'; end if;
  if v_control.circuit_open_until is not null and v_control.circuit_open_until>now() then raise exception 'creator_studio_provider_circuit_open'; end if;

  select * into v_project from public.creator_studio_projects where id=_project_id for update;
  if v_project.id is null or v_project.owner_user_id<>_actor_user_id then raise exception 'creator_studio_project_not_found'; end if;
  if v_project.status<>'READY' then raise exception 'creator_studio_project_not_ready'; end if;

  insert into public.creator_studio_entitlements(owner_user_id) values(_actor_user_id) on conflict(owner_user_id) do nothing;
  select * into v_ent from public.creator_studio_entitlements where owner_user_id=_actor_user_id for update;

  select j.* into v_existing from public.creator_studio_render_jobs j
  where j.owner_user_id=_actor_user_id and j.idempotency_key=_idempotency_key;
  if v_existing.id is not null then
    select u.source into v_existing_source from public.creator_studio_usage_reservations u where u.render_job_id=v_existing.id;
    return query select v_existing.id,v_existing.quality,coalesce(v_existing_source,'LEGACY');
    return;
  end if;

  select count(*) into v_active from public.creator_studio_render_jobs
  where owner_user_id=_actor_user_id and status in ('QUEUED','SUBMITTED','RENDERING');
  if v_active>=v_control.max_concurrent_per_user then raise exception 'creator_studio_render_concurrency_limit'; end if;

  v_active_paid := v_ent.plan_key in ('CREATOR_PRO','CREATOR_BUSINESS')
    and v_ent.billing_status='ACTIVE'
    and v_ent.current_period_start is not null
    and v_ent.current_period_end is not null
    and now()>=v_ent.current_period_start
    and now()<v_ent.current_period_end;

  if v_active_paid then
    v_allowance:=case v_ent.plan_key when 'CREATOR_PRO' then 10 else 50 end;
    select count(*) into v_used from public.creator_studio_usage_reservations
    where owner_user_id=_actor_user_id and source='PLAN_INCLUDED'
      and period_start=v_ent.current_period_start and state in ('RESERVED','CONSUMED');
    if v_used<v_allowance then v_quality:='STANDARD'; v_source:='PLAN_INCLUDED'; end if;
  end if;

  if v_source is null then
    select id into v_credit_id from public.creator_studio_extra_video_credits
    where owner_user_id=_actor_user_id and quantity_remaining>0
    order by created_at,id limit 1 for update;
    if v_credit_id is not null then
      update public.creator_studio_extra_video_credits set quantity_remaining=quantity_remaining-1 where id=v_credit_id;
      v_quality:='STANDARD'; v_source:='EXTRA_CREDIT';
    end if;
  end if;

  if v_source is null and not v_active_paid then
    select count(*) into v_used from public.creator_studio_usage_reservations
    where owner_user_id=_actor_user_id and source='FREE_PREVIEW' and state in ('RESERVED','CONSUMED');
    if v_used=0 then
      select count(*) into v_attempts from public.creator_studio_usage_reservations
      where owner_user_id=_actor_user_id and source='FREE_PREVIEW' and reserved_at>now()-interval '24 hours';
      if v_attempts>=3 then raise exception 'creator_studio_free_preview_rate_limit'; end if;
      v_quality:='PREVIEW'; v_source:='FREE_PREVIEW';
    end if;
  end if;

  if v_source is null then raise exception 'creator_studio_video_allowance_exhausted'; end if;

  v_estimated:=ceil(v_project.duration_seconds::numeric/60.0*v_control.estimated_cost_cents_per_minute);
  insert into public.creator_studio_render_jobs(project_id,owner_user_id,template_version,quality,requested_duration_seconds,estimated_cost_cents,idempotency_key,timeout_at)
  values(v_project.id,_actor_user_id,_template_version,v_quality,v_project.duration_seconds,v_estimated,_idempotency_key,now()+make_interval(secs=>v_control.timeout_seconds)) returning id into v_job;
  insert into public.creator_studio_usage_reservations(render_job_id,owner_user_id,source,plan_key,period_start,period_end,extra_credit_id)
  values(v_job,_actor_user_id,v_source,case when v_source='PLAN_INCLUDED' then v_ent.plan_key else 'FREE' end,
    case when v_source='PLAN_INCLUDED' then v_ent.current_period_start else null end,
    case when v_source='PLAN_INCLUDED' then v_ent.current_period_end else null end,v_credit_id);
  insert into public.creator_studio_events(owner_user_id,project_id,event_type,entity_id,metadata)
  values(_actor_user_id,_project_id,'RENDER_RESERVED',v_job,jsonb_build_object('quality',v_quality,'usage_source',v_source,'estimated_cost_cents',v_estimated));
  return query select v_job,v_quality,v_source;
end;
$$;
revoke all on function public.creator_studio_server_reserve_entitled_render_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.creator_studio_server_reserve_entitled_render_job(uuid,uuid,text,text) to service_role;