-- AurumVault Creator Studio™ — CS1 asset RPC hardening
-- Keep privileged asset mutations behind the authenticated AurumVault server layer.
-- Browser roles cannot execute these RPCs directly.

-- The CS1 tables remain RLS-protected for browser reads/writes. The trusted
-- server client needs explicit table privileges because 2026 Supabase projects
-- may no longer auto-grant Data API privileges to new public objects.
grant select, insert, update, delete on table public.creator_studio_projects to service_role;
grant select, insert, update, delete on table public.creator_studio_assets to service_role;
grant select, insert, update, delete on table public.creator_studio_project_assets to service_role;
grant select, insert, update, delete on table public.creator_studio_events to service_role;

-- Remove the authenticated-callable SECURITY DEFINER RPC surface created by
-- the foundation migration. These functions are superseded below by
-- service-role-only SECURITY INVOKER functions with an explicit actor id.
revoke execute on function public.creator_studio_reserve_asset(uuid,uuid,text,text,text,text,bigint)
  from public, anon, authenticated, service_role;
revoke execute on function public.creator_studio_release_reserved_asset(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.creator_studio_complete_asset(uuid,integer,integer)
  from public, anon, authenticated, service_role;
revoke execute on function public.creator_studio_remove_asset(uuid)
  from public, anon, authenticated, service_role;

drop function public.creator_studio_reserve_asset(uuid,uuid,text,text,text,text,bigint);
drop function public.creator_studio_release_reserved_asset(uuid);
drop function public.creator_studio_complete_asset(uuid,integer,integer);
drop function public.creator_studio_remove_asset(uuid);

create or replace function public.creator_studio_server_reserve_asset(
  _actor_user_id uuid,
  _project_id uuid,
  _asset_id uuid,
  _category text,
  _storage_path text,
  _original_filename text,
  _mime_type text,
  _byte_size bigint
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
  v_status text;
  v_count integer;
  v_limit integer;
begin
  if _actor_user_id is null then
    raise exception 'unauthorized';
  end if;
  if _byte_size < 1 or _byte_size > 52428800 then
    raise exception 'creator_studio_asset_size_invalid';
  end if;
  if _category not in ('PRODUCT_COVER','SCREENSHOT','LOGO','ADDITIONAL_MEDIA') then
    raise exception 'creator_studio_asset_category_invalid';
  end if;
  if (
    _category in ('PRODUCT_COVER','SCREENSHOT','LOGO')
    and _mime_type not in ('image/jpeg','image/png','image/webp')
  ) or (
    _category = 'ADDITIONAL_MEDIA'
    and _mime_type not in ('image/jpeg','image/png','image/webp','video/mp4')
  ) then
    raise exception 'creator_studio_asset_mime_invalid';
  end if;

  select owner_user_id, status into v_owner, v_status
  from public.creator_studio_projects
  where id = _project_id
  for update;

  if v_owner is null or v_owner <> _actor_user_id then
    raise exception 'creator_studio_project_not_found';
  end if;
  if v_status not in ('DRAFT','READY') then
    raise exception 'creator_studio_project_locked';
  end if;
  if _storage_path not like _actor_user_id::text || '/' || _project_id::text || '/' || _asset_id::text || '/%' then
    raise exception 'creator_studio_asset_path_invalid';
  end if;

  v_limit := case _category
    when 'PRODUCT_COVER' then 1
    when 'SCREENSHOT' then 8
    when 'LOGO' then 1
    else 4
  end;

  select count(*) into v_count
  from public.creator_studio_project_assets pa
  join public.creator_studio_assets a on a.id = pa.asset_id
  where pa.project_id = _project_id
    and a.category = _category
    and a.state in ('PENDING_UPLOAD','READY');

  if v_count >= v_limit then
    raise exception 'creator_studio_asset_limit_reached:%', _category;
  end if;

  if v_status = 'READY' then
    update public.creator_studio_projects
    set status = 'DRAFT'
    where id = _project_id;
  end if;

  insert into public.creator_studio_assets (
    id, owner_user_id, category, state, storage_path,
    original_filename, mime_type, byte_size
  ) values (
    _asset_id, v_owner, _category, 'PENDING_UPLOAD', _storage_path,
    left(_original_filename, 255), _mime_type, _byte_size
  );

  insert into public.creator_studio_project_assets (
    project_id, asset_id, owner_user_id, sort_order
  ) values (
    _project_id, _asset_id, v_owner, v_count
  );

  insert into public.creator_studio_events (
    owner_user_id, project_id, event_type, entity_id, metadata
  ) values (
    v_owner, _project_id, 'ASSET_UPLOAD_RESERVED', _asset_id,
    pg_catalog.jsonb_build_object('category', _category, 'byte_size', _byte_size)
  );

  return _asset_id;
end;
$$;

create or replace function public.creator_studio_server_release_reserved_asset(
  _actor_user_id uuid,
  _asset_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
  v_project uuid;
  v_state text;
begin
  select a.owner_user_id, pa.project_id, a.state
    into v_owner, v_project, v_state
  from public.creator_studio_assets a
  join public.creator_studio_project_assets pa on pa.asset_id = a.id
  where a.id = _asset_id;

  if _actor_user_id is null or v_owner is null or v_owner <> _actor_user_id then
    return false;
  end if;
  if v_state <> 'PENDING_UPLOAD' then
    return false;
  end if;

  delete from public.creator_studio_assets where id = _asset_id;
  insert into public.creator_studio_events (
    owner_user_id, project_id, event_type, entity_id
  ) values (v_owner, v_project, 'ASSET_UPLOAD_RELEASED', _asset_id);
  return true;
end;
$$;

create or replace function public.creator_studio_server_complete_asset(
  _actor_user_id uuid,
  _asset_id uuid,
  _width integer default null,
  _height integer default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
  v_project uuid;
begin
  select a.owner_user_id, pa.project_id
    into v_owner, v_project
  from public.creator_studio_assets a
  join public.creator_studio_project_assets pa on pa.asset_id = a.id
  where a.id = _asset_id and a.state = 'PENDING_UPLOAD'
  for update of a;

  if _actor_user_id is null or v_owner is null or v_owner <> _actor_user_id then
    return false;
  end if;

  update public.creator_studio_assets
  set state = 'READY',
      width = case when _width is not null and _width > 0 then _width else width end,
      height = case when _height is not null and _height > 0 then _height else height end,
      updated_at = now()
  where id = _asset_id;

  insert into public.creator_studio_events (
    owner_user_id, project_id, event_type, entity_id
  ) values (v_owner, v_project, 'ASSET_READY', _asset_id);
  return true;
end;
$$;

create or replace function public.creator_studio_server_remove_asset(
  _actor_user_id uuid,
  _asset_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
  v_project uuid;
  v_path text;
  v_status text;
begin
  select a.owner_user_id, pa.project_id, a.storage_path, p.status
    into v_owner, v_project, v_path, v_status
  from public.creator_studio_assets a
  join public.creator_studio_project_assets pa on pa.asset_id = a.id
  join public.creator_studio_projects p on p.id = pa.project_id
  where a.id = _asset_id
  for update of p;

  if _actor_user_id is null or v_owner is null or v_owner <> _actor_user_id then
    raise exception 'creator_studio_asset_not_found';
  end if;
  if v_status not in ('DRAFT','READY') then
    raise exception 'creator_studio_project_locked';
  end if;

  if v_status = 'READY' then
    update public.creator_studio_projects set status = 'DRAFT' where id = v_project;
  end if;

  delete from public.creator_studio_assets where id = _asset_id;
  insert into public.creator_studio_events (
    owner_user_id, project_id, event_type, entity_id
  ) values (v_owner, v_project, 'ASSET_REMOVED', _asset_id);
  return v_path;
end;
$$;

revoke all on function public.creator_studio_server_reserve_asset(uuid,uuid,uuid,text,text,text,text,bigint)
  from public, anon, authenticated;
revoke all on function public.creator_studio_server_release_reserved_asset(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.creator_studio_server_complete_asset(uuid,uuid,integer,integer)
  from public, anon, authenticated;
revoke all on function public.creator_studio_server_remove_asset(uuid,uuid)
  from public, anon, authenticated;

grant execute on function public.creator_studio_server_reserve_asset(uuid,uuid,uuid,text,text,text,text,bigint)
  to service_role;
grant execute on function public.creator_studio_server_release_reserved_asset(uuid,uuid)
  to service_role;
grant execute on function public.creator_studio_server_complete_asset(uuid,uuid,integer,integer)
  to service_role;
grant execute on function public.creator_studio_server_remove_asset(uuid,uuid)
  to service_role;

-- Trigger execution does not need a browser EXECUTE grant. Keep the audit
-- trigger privileged but remove it from the public Data API function surface.
alter function public.creator_studio_audit_project() set search_path = '';
revoke execute on function public.creator_studio_audit_project()
  from public, anon, authenticated, service_role;
