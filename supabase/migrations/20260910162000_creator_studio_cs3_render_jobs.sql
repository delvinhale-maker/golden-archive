-- AurumVault Creator Studio™ — CS3 render-job and provider foundation.
-- Runtime rendering is disabled by default. No provider call is possible until
-- a trusted server-side operator explicitly enables the singleton control row.

create table public.creator_studio_render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.creator_studio_projects(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'SHOTSTACK' check (provider = 'SHOTSTACK'),
  provider_job_id text null unique check (provider_job_id is null or char_length(provider_job_id) between 8 and 128),
  template_version text not null check (template_version ~ '^\d+\.\d+\.\d+$'),
  quality text not null check (quality in ('PREVIEW','STANDARD')),
  status text not null default 'QUEUED' check (
    status in ('QUEUED','SUBMITTED','RENDERING','SUCCEEDED','FAILED','CANCELLED')
  ),
  requested_duration_seconds integer not null check (requested_duration_seconds in (15,30,45)),
  estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0),
  actual_cost_cents integer null check (actual_cost_cents is null or actual_cost_cents >= 0),
  output_storage_path text null check (output_storage_path is null or char_length(output_storage_path) <= 1024),
  error_code text null check (error_code is null or char_length(error_code) <= 80),
  safe_error_message text null check (safe_error_message is null or char_length(safe_error_message) <= 300),
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 128),
  attempt_count integer not null default 1 check (attempt_count between 1 and 10),
  started_at timestamptz null,
  completed_at timestamptz null,
  timeout_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, idempotency_key)
);

-- Provider-only metadata is intentionally not selectable by authenticated users.
create table public.creator_studio_provider_state (
  render_job_id uuid primary key references public.creator_studio_render_jobs(id) on delete cascade,
  callback_secret_hash text not null check (callback_secret_hash ~ '^[0-9a-f]{64}$'),
  provider_status text null check (provider_status is null or char_length(provider_status) <= 80),
  provider_output_url text null check (provider_output_url is null or char_length(provider_output_url) <= 4096),
  provider_metadata jsonb not null default '{}'::jsonb check (octet_length(provider_metadata::text) <= 131072),
  last_checked_at timestamptz null,
  updated_at timestamptz not null default now()
);

create table public.creator_studio_runtime_control (
  singleton boolean primary key default true check (singleton),
  rendering_enabled boolean not null default false,
  max_concurrent_per_user integer not null default 1 check (max_concurrent_per_user between 1 and 5),
  max_attempts integer not null default 2 check (max_attempts between 1 and 5),
  timeout_seconds integer not null default 900 check (timeout_seconds between 60 and 3600),
  max_output_bytes bigint not null default 262144000 check (max_output_bytes between 1048576 and 536870912),
  estimated_cost_cents_per_minute integer not null default 0 check (estimated_cost_cents_per_minute >= 0),
  consecutive_provider_failures integer not null default 0 check (consecutive_provider_failures >= 0),
  failure_window_started_at timestamptz null,
  circuit_open_until timestamptz null,
  updated_at timestamptz not null default now()
);

insert into public.creator_studio_runtime_control(singleton) values (true)
on conflict (singleton) do nothing;

create index creator_studio_render_jobs_owner_created_idx
  on public.creator_studio_render_jobs(owner_user_id, created_at desc);
create index creator_studio_render_jobs_project_created_idx
  on public.creator_studio_render_jobs(project_id, created_at desc);
create index creator_studio_render_jobs_active_owner_idx
  on public.creator_studio_render_jobs(owner_user_id, status)
  where status in ('QUEUED','SUBMITTED','RENDERING');

create or replace function public.creator_studio_render_job_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project_owner uuid;
begin
  select owner_user_id into v_project_owner
  from public.creator_studio_projects
  where id = new.project_id;

  if v_project_owner is null or v_project_owner <> new.owner_user_id then
    raise exception 'creator_studio_render_project_owner_mismatch';
  end if;

  if tg_op = 'UPDATE' and (
    new.owner_user_id is distinct from old.owner_user_id
    or new.project_id is distinct from old.project_id
    or new.provider is distinct from old.provider
    or new.idempotency_key is distinct from old.idempotency_key
    or new.requested_duration_seconds is distinct from old.requested_duration_seconds
    or new.quality is distinct from old.quality
    or new.template_version is distinct from old.template_version
  ) then
    raise exception 'creator_studio_render_identity_immutable';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger creator_studio_render_job_guard_before_write
before insert or update on public.creator_studio_render_jobs
for each row execute function public.creator_studio_render_job_guard();

alter table public.creator_studio_render_jobs enable row level security;
alter table public.creator_studio_provider_state enable row level security;
alter table public.creator_studio_runtime_control enable row level security;

revoke all on table public.creator_studio_render_jobs from anon, authenticated;
revoke all on table public.creator_studio_provider_state from anon, authenticated;
revoke all on table public.creator_studio_runtime_control from anon, authenticated;
grant select on table public.creator_studio_render_jobs to authenticated;

create policy creator_studio_render_jobs_select_owner
on public.creator_studio_render_jobs for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or (select public.has_role((select auth.uid()), 'admin'))
);

create or replace function public.creator_studio_server_reserve_render_job(
  _actor_user_id uuid,
  _project_id uuid,
  _idempotency_key text,
  _quality text,
  _template_version text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing uuid;
  v_project public.creator_studio_projects%rowtype;
  v_control public.creator_studio_runtime_control%rowtype;
  v_active integer;
  v_estimated integer;
  v_job uuid;
begin
  if _actor_user_id is null then raise exception 'creator_studio_actor_required'; end if;
  if char_length(_idempotency_key) < 16 or char_length(_idempotency_key) > 128 then
    raise exception 'creator_studio_idempotency_invalid';
  end if;
  if _quality not in ('PREVIEW','STANDARD') then raise exception 'creator_studio_quality_invalid'; end if;

  select id into v_existing from public.creator_studio_render_jobs
  where owner_user_id = _actor_user_id and idempotency_key = _idempotency_key;
  if v_existing is not null then return v_existing; end if;

  select * into v_control from public.creator_studio_runtime_control where singleton for update;
  if not v_control.rendering_enabled then raise exception 'creator_studio_rendering_disabled'; end if;
  if v_control.circuit_open_until is not null and v_control.circuit_open_until > now() then
    raise exception 'creator_studio_provider_circuit_open';
  end if;

  select * into v_project from public.creator_studio_projects where id = _project_id for update;
  if v_project.id is null or v_project.owner_user_id <> _actor_user_id then
    raise exception 'creator_studio_project_not_found';
  end if;
  if v_project.status <> 'READY' then raise exception 'creator_studio_project_not_ready'; end if;

  select count(*) into v_active
  from public.creator_studio_render_jobs
  where owner_user_id = _actor_user_id and status in ('QUEUED','SUBMITTED','RENDERING');
  if v_active >= v_control.max_concurrent_per_user then
    raise exception 'creator_studio_render_concurrency_limit';
  end if;

  v_estimated := ceil(v_project.duration_seconds::numeric / 60.0 * v_control.estimated_cost_cents_per_minute);
  insert into public.creator_studio_render_jobs(
    project_id, owner_user_id, template_version, quality, requested_duration_seconds,
    estimated_cost_cents, idempotency_key, timeout_at
  ) values (
    v_project.id, _actor_user_id, _template_version, _quality, v_project.duration_seconds,
    v_estimated, _idempotency_key, now() + make_interval(secs => v_control.timeout_seconds)
  ) returning id into v_job;

  insert into public.creator_studio_events(owner_user_id, project_id, event_type, entity_id, metadata)
  values (_actor_user_id, _project_id, 'RENDER_RESERVED', v_job,
    jsonb_build_object('quality', _quality, 'estimated_cost_cents', v_estimated));
  return v_job;
end;
$$;

create or replace function public.creator_studio_server_mark_render_submitted(
  _render_job_id uuid,
  _provider_job_id text,
  _callback_secret_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job public.creator_studio_render_jobs%rowtype;
begin
  select * into v_job from public.creator_studio_render_jobs where id = _render_job_id for update;
  if v_job.id is null then return false; end if;
  if v_job.status <> 'QUEUED' then return v_job.provider_job_id = _provider_job_id; end if;

  update public.creator_studio_render_jobs
  set status='SUBMITTED', provider_job_id=_provider_job_id, started_at=coalesce(started_at, now())
  where id=_render_job_id;
  insert into public.creator_studio_provider_state(render_job_id, callback_secret_hash, provider_status)
  values (_render_job_id, _callback_secret_hash, 'queued')
  on conflict (render_job_id) do nothing;
  update public.creator_studio_projects set status='RENDERING' where id=v_job.project_id and status='READY';
  insert into public.creator_studio_events(owner_user_id, project_id, event_type, entity_id)
  values(v_job.owner_user_id, v_job.project_id, 'RENDER_SUBMITTED', v_job.id);
  return true;
end;
$$;

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
  v_control public.creator_studio_runtime_control%rowtype;
begin
  select * into v_job from public.creator_studio_render_jobs where id=_render_job_id for update;
  if v_job.id is null then return false; end if;
  if v_job.status in ('SUCCEEDED','FAILED','CANCELLED') then return true; end if;
  update public.creator_studio_render_jobs set status='FAILED', error_code=left(_error_code,80),
    safe_error_message=left(_safe_error_message,300), completed_at=now() where id=_render_job_id;

  select * into v_control from public.creator_studio_runtime_control where singleton for update;
  if v_control.failure_window_started_at is null or v_control.failure_window_started_at < now()-interval '10 minutes' then
    update public.creator_studio_runtime_control set consecutive_provider_failures=1,
      failure_window_started_at=now(), updated_at=now() where singleton;
  elsif v_control.consecutive_provider_failures + 1 >= 5 then
    update public.creator_studio_runtime_control set consecutive_provider_failures=consecutive_provider_failures+1,
      circuit_open_until=now()+interval '15 minutes', updated_at=now() where singleton;
  else
    update public.creator_studio_runtime_control set consecutive_provider_failures=consecutive_provider_failures+1,
      updated_at=now() where singleton;
  end if;
  insert into public.creator_studio_events(owner_user_id, project_id, event_type, entity_id, metadata)
  values(v_job.owner_user_id, v_job.project_id, 'RENDER_FAILED', v_job.id,
    jsonb_build_object('error_code', left(_error_code,80)));
  return true;
end;
$$;

create or replace function public.creator_studio_server_apply_provider_status(
  _render_job_id uuid,
  _job_status text,
  _provider_status text,
  _provider_output_url text default null,
  _output_storage_path text default null,
  _error_code text default null,
  _safe_error_message text default null,
  _actual_cost_cents integer default null,
  _provider_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job public.creator_studio_render_jobs%rowtype;
begin
  if _job_status not in ('RENDERING','SUCCEEDED','FAILED','CANCELLED') then
    raise exception 'creator_studio_provider_status_invalid';
  end if;
  select * into v_job from public.creator_studio_render_jobs where id=_render_job_id for update;
  if v_job.id is null then return false; end if;
  if v_job.status='CANCELLED' then return true; end if;
  if v_job.status='SUCCEEDED' and _job_status <> 'SUCCEEDED' then return true; end if;
  if v_job.status='FAILED' and _job_status <> 'FAILED' then return true; end if;

  update public.creator_studio_provider_state set provider_status=left(_provider_status,80),
    provider_output_url=case when _provider_output_url is null then provider_output_url else left(_provider_output_url,4096) end,
    provider_metadata=case when octet_length(_provider_metadata::text)<=131072 then _provider_metadata else '{}'::jsonb end,
    last_checked_at=now(), updated_at=now() where render_job_id=_render_job_id;

  update public.creator_studio_render_jobs set status=_job_status,
    output_storage_path=coalesce(_output_storage_path, output_storage_path),
    error_code=case when _job_status='FAILED' then left(_error_code,80) else null end,
    safe_error_message=case when _job_status='FAILED' then left(_safe_error_message,300) else null end,
    actual_cost_cents=coalesce(_actual_cost_cents, actual_cost_cents),
    completed_at=case when _job_status in ('SUCCEEDED','FAILED','CANCELLED') then coalesce(completed_at,now()) else completed_at end
  where id=_render_job_id;

  if _job_status='SUCCEEDED' then
    update public.creator_studio_projects set status='COMPLETED' where id=v_job.project_id and status='RENDERING';
    update public.creator_studio_runtime_control set consecutive_provider_failures=0,
      failure_window_started_at=null, circuit_open_until=null, updated_at=now() where singleton;
  elsif _job_status='FAILED' then
    update public.creator_studio_projects set status='FAILED' where id=v_job.project_id and status='RENDERING';
  end if;
  return true;
end;
$$;

create or replace function public.creator_studio_server_cancel_render(
  _actor_user_id uuid,
  _render_job_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job public.creator_studio_render_jobs%rowtype;
begin
  select * into v_job from public.creator_studio_render_jobs where id=_render_job_id for update;
  if v_job.id is null or v_job.owner_user_id <> _actor_user_id then return false; end if;
  if v_job.status in ('SUCCEEDED','FAILED','CANCELLED') then return true; end if;
  update public.creator_studio_render_jobs set status='CANCELLED', completed_at=now() where id=_render_job_id;
  if v_job.status in ('SUBMITTED','RENDERING') then
    update public.creator_studio_projects set status='CANCELLED' where id=v_job.project_id and status='RENDERING';
  end if;
  insert into public.creator_studio_events(owner_user_id,project_id,event_type,entity_id)
  values(v_job.owner_user_id,v_job.project_id,'RENDER_CANCELLED',v_job.id);
  return true;
end;
$$;

revoke all on function public.creator_studio_server_reserve_render_job(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.creator_studio_server_mark_render_submitted(uuid,text,text) from public, anon, authenticated;
revoke all on function public.creator_studio_server_mark_submission_failed(uuid,text,text) from public, anon, authenticated;
revoke all on function public.creator_studio_server_apply_provider_status(uuid,text,text,text,text,text,text,integer,jsonb) from public, anon, authenticated;
revoke all on function public.creator_studio_server_cancel_render(uuid,uuid) from public, anon, authenticated;
grant execute on function public.creator_studio_server_reserve_render_job(uuid,uuid,text,text,text) to service_role;
grant execute on function public.creator_studio_server_mark_render_submitted(uuid,text,text) to service_role;
grant execute on function public.creator_studio_server_mark_submission_failed(uuid,text,text) to service_role;
grant execute on function public.creator_studio_server_apply_provider_status(uuid,text,text,text,text,text,text,integer,jsonb) to service_role;
grant execute on function public.creator_studio_server_cancel_render(uuid,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('creator-studio-output','creator-studio-output',false,262144000,array['video/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Deliberately no authenticated storage.objects policies for output media.
