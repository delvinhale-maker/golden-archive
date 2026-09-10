-- CS3 watchdog + cost capture hardening.
-- Count every terminal provider failure once, calculate actual cost from verified
-- provider billable seconds, and expose a service-only timeout sweep primitive.

create or replace function public.creator_studio_track_render_failure()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_control public.creator_studio_runtime_control%rowtype;
begin
  if new.status <> 'FAILED' or old.status = 'FAILED' then
    return new;
  end if;

  select * into v_control
  from public.creator_studio_runtime_control
  where singleton
  for update;

  if v_control.failure_window_started_at is null
     or v_control.failure_window_started_at < now() - interval '10 minutes' then
    update public.creator_studio_runtime_control
    set consecutive_provider_failures = 1,
        failure_window_started_at = now(),
        circuit_open_until = null,
        updated_at = now()
    where singleton;
  elsif v_control.consecutive_provider_failures + 1 >= 5 then
    update public.creator_studio_runtime_control
    set consecutive_provider_failures = consecutive_provider_failures + 1,
        circuit_open_until = now() + interval '15 minutes',
        updated_at = now()
    where singleton;
  else
    update public.creator_studio_runtime_control
    set consecutive_provider_failures = consecutive_provider_failures + 1,
        updated_at = now()
    where singleton;
  end if;
  return new;
end;
$$;

create trigger creator_studio_track_render_failure_after_update
after update of status on public.creator_studio_render_jobs
for each row execute function public.creator_studio_track_render_failure();

-- Replace the earlier submission-failure function so failure accounting is
-- centralized in the status-transition trigger above and cannot double count.
create or replace function public.creator_studio_server_mark_submission_failed(
  _render_job_id uuid,
  _error_code text,
  _safe_error_message text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job public.creator_studio_render_jobs%rowtype;
begin
  select * into v_job
  from public.creator_studio_render_jobs
  where id = _render_job_id
  for update;

  if v_job.id is null then return false; end if;
  if v_job.status in ('SUCCEEDED','FAILED','CANCELLED') then return true; end if;

  update public.creator_studio_render_jobs
  set status = 'FAILED',
      error_code = left(_error_code,80),
      safe_error_message = left(_safe_error_message,300),
      completed_at = now()
  where id = _render_job_id;

  insert into public.creator_studio_events(owner_user_id, project_id, event_type, entity_id, metadata)
  values(
    v_job.owner_user_id,
    v_job.project_id,
    'RENDER_FAILED',
    v_job.id,
    jsonb_build_object('error_code', left(_error_code,80))
  );
  return true;
end;
$$;

create or replace function public.creator_studio_capture_provider_cost()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_seconds numeric;
  v_rate integer;
  v_cost integer;
begin
  if new.provider_metadata ? 'billableSeconds' then
    begin
      v_seconds := (new.provider_metadata ->> 'billableSeconds')::numeric;
    exception when others then
      v_seconds := null;
    end;
  end if;

  if v_seconds is null or v_seconds < 0 then return new; end if;
  select estimated_cost_cents_per_minute into v_rate
  from public.creator_studio_runtime_control
  where singleton;
  v_cost := ceil(v_seconds / 60.0 * coalesce(v_rate,0));

  update public.creator_studio_render_jobs
  set actual_cost_cents = greatest(0,v_cost)
  where id = new.render_job_id
    and actual_cost_cents is null;
  return new;
end;
$$;

create trigger creator_studio_capture_provider_cost_after_write
after insert or update of provider_metadata on public.creator_studio_provider_state
for each row execute function public.creator_studio_capture_provider_cost();

create or replace function public.creator_studio_server_expire_stuck_renders(
  _limit integer default 25
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer := 0;
  v_job record;
begin
  for v_job in
    select id, owner_user_id, project_id
    from public.creator_studio_render_jobs
    where status in ('QUEUED','SUBMITTED','RENDERING')
      and timeout_at is not null
      and timeout_at <= now()
    order by timeout_at asc
    limit greatest(1,least(coalesce(_limit,25),100))
    for update skip locked
  loop
    update public.creator_studio_render_jobs
    set status='FAILED',
        error_code='PROVIDER_TIMEOUT',
        safe_error_message='The video service did not finish in time. Your project has been preserved.',
        completed_at=now()
    where id=v_job.id;

    update public.creator_studio_projects
    set status='FAILED'
    where id=v_job.project_id and status='RENDERING';

    insert into public.creator_studio_events(owner_user_id,project_id,event_type,entity_id,metadata)
    values(v_job.owner_user_id,v_job.project_id,'RENDER_FAILED',v_job.id,
      jsonb_build_object('error_code','PROVIDER_TIMEOUT'));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.creator_studio_server_expire_stuck_renders(integer)
  from public, anon, authenticated;
grant execute on function public.creator_studio_server_expire_stuck_renders(integer)
  to service_role;
