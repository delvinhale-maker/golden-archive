-- Prevent concurrent callers that resolve to the same idempotent render job
-- from both submitting a paid provider request.

create or replace function public.creator_studio_server_claim_render_submission(
  _render_job_id uuid,
  _callback_secret_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job public.creator_studio_render_jobs%rowtype;
  v_inserted integer;
begin
  if _callback_secret_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'creator_studio_callback_hash_invalid';
  end if;

  select * into v_job
  from public.creator_studio_render_jobs
  where id = _render_job_id
  for update;

  if v_job.id is null or v_job.status <> 'QUEUED' then
    return false;
  end if;

  insert into public.creator_studio_provider_state(
    render_job_id, callback_secret_hash, provider_status
  ) values (_render_job_id, _callback_secret_hash, 'submitting')
  on conflict (render_job_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
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
  v_hash text;
begin
  select j.*, s.callback_secret_hash into v_job, v_hash
  from public.creator_studio_render_jobs j
  join public.creator_studio_provider_state s on s.render_job_id = j.id
  where j.id = _render_job_id
  for update of j;

  if v_job.id is null then return false; end if;
  if v_job.status <> 'QUEUED' then return v_job.provider_job_id = _provider_job_id; end if;
  if v_hash is distinct from _callback_secret_hash then
    raise exception 'creator_studio_callback_claim_mismatch';
  end if;

  update public.creator_studio_render_jobs
  set status='SUBMITTED', provider_job_id=_provider_job_id, started_at=coalesce(started_at, now())
  where id=_render_job_id;

  update public.creator_studio_provider_state
  set provider_status='queued', updated_at=now()
  where render_job_id=_render_job_id;

  update public.creator_studio_projects
  set status='RENDERING'
  where id=v_job.project_id and status='READY';

  insert into public.creator_studio_events(owner_user_id, project_id, event_type, entity_id)
  values(v_job.owner_user_id, v_job.project_id, 'RENDER_SUBMITTED', v_job.id);
  return true;
end;
$$;

revoke all on function public.creator_studio_server_claim_render_submission(uuid,text)
  from public, anon, authenticated;
grant execute on function public.creator_studio_server_claim_render_submission(uuid,text)
  to service_role;
