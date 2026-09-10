-- AurumVault Creator Studio™ — CS1 foundation
-- Schema only. Do not apply to the production Supabase project.
-- Apply first to an isolated staging backend after CS1 code review.

create table public.creator_studio_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_product_id uuid null references public.marketplace_products(id) on delete set null,
  project_type text not null check (
    project_type in (
      'PROMOTE_EBOOK','PROMOTE_COURSE','PROMOTE_PLANNER','TIKTOK_AD',
      'INSTAGRAM_REEL','PRODUCT_TRAILER','BOOK_TRAILER'
    )
  ),
  title text not null default 'Untitled video project' check (char_length(title) between 1 and 160),
  product_title text null check (product_title is null or char_length(product_title) <= 180),
  status text not null default 'DRAFT' check (
    status in ('DRAFT','READY','RENDERING','COMPLETED','FAILED','CANCELLED')
  ),
  duration_seconds integer not null default 30 check (duration_seconds in (15,30,45)),
  aspect_ratio text not null default '9:16' check (aspect_ratio = '9:16'),
  style_key text not null default 'LUXURY_EDITORIAL' check (
    style_key in (
      'LUXURY_EDITORIAL','BOLD_SOCIAL','CINEMATIC',
      'CLEAN_MINIMAL','CREATOR_ENERGY','BOOK_TRAILER'
    )
  ),
  hook text null check (hook is null or char_length(hook) <= 240),
  cta text null check (cta is null or char_length(cta) <= 120),
  destination_url text null check (destination_url is null or char_length(destination_url) <= 2048),
  price_cents integer null check (price_cents is null or price_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  wizard_step integer not null default 1 check (wizard_step between 1 and 7),
  metadata jsonb not null default '{}'::jsonb check (octet_length(metadata::text) <= 16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_studio_assets (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (
    category in ('PRODUCT_COVER','SCREENSHOT','LOGO','ADDITIONAL_MEDIA')
  ),
  state text not null default 'PENDING_UPLOAD' check (
    state in ('PENDING_UPLOAD','READY','FAILED')
  ),
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null,
  byte_size bigint not null check (byte_size between 1 and 52428800),
  width integer null check (width is null or width > 0),
  height integer null check (height is null or height > 0),
  metadata jsonb not null default '{}'::jsonb check (octet_length(metadata::text) <= 16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_studio_project_assets (
  project_id uuid not null references public.creator_studio_projects(id) on delete cascade,
  asset_id uuid not null references public.creator_studio_assets(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order between 0 and 100),
  created_at timestamptz not null default now(),
  primary key (project_id, asset_id)
);

create table public.creator_studio_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.creator_studio_projects(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 80),
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb check (octet_length(metadata::text) <= 16384),
  created_at timestamptz not null default now()
);

create index creator_studio_projects_owner_updated_idx
  on public.creator_studio_projects(owner_user_id, updated_at desc);
create index creator_studio_projects_source_product_idx
  on public.creator_studio_projects(source_product_id)
  where source_product_id is not null;
create index creator_studio_assets_owner_created_idx
  on public.creator_studio_assets(owner_user_id, created_at desc);
create index creator_studio_project_assets_owner_project_idx
  on public.creator_studio_project_assets(owner_user_id, project_id, sort_order);
create index creator_studio_events_owner_project_idx
  on public.creator_studio_events(owner_user_id, project_id, created_at desc);

create or replace function public.creator_studio_guard_asset()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id
    or new.category is distinct from old.category
    or new.storage_path is distinct from old.storage_path
    or new.original_filename is distinct from old.original_filename
    or new.mime_type is distinct from old.mime_type
    or new.byte_size is distinct from old.byte_size then
    raise exception 'creator_studio_asset_identity_immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger creator_studio_guard_asset_before_update
before update on public.creator_studio_assets
for each row execute function public.creator_studio_guard_asset();

create or replace function public.creator_studio_guard_project_asset_link()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project_owner uuid;
  v_asset_owner uuid;
begin
  select owner_user_id into v_project_owner
  from public.creator_studio_projects where id = new.project_id;
  select owner_user_id into v_asset_owner
  from public.creator_studio_assets where id = new.asset_id;

  if v_project_owner is null
    or v_asset_owner is null
    or v_project_owner <> v_asset_owner
    or new.owner_user_id <> v_project_owner then
    raise exception 'creator_studio_cross_owner_asset_link_denied';
  end if;

  if tg_op = 'UPDATE' and (
    new.project_id is distinct from old.project_id
    or new.asset_id is distinct from old.asset_id
    or new.owner_user_id is distinct from old.owner_user_id
  ) then
    raise exception 'creator_studio_asset_link_identity_immutable';
  end if;
  return new;
end;
$$;

create trigger creator_studio_guard_project_asset_link_before_write
before insert or update on public.creator_studio_project_assets
for each row execute function public.creator_studio_guard_project_asset_link();

create or replace function public.creator_studio_valid_transition(_from text, _to text)
returns boolean
language sql
immutable
as $$
  select
    _from = _to
    or (_from = 'DRAFT' and _to in ('READY','CANCELLED'))
    or (_from = 'READY' and _to in ('DRAFT','RENDERING','CANCELLED'))
    or (_from = 'RENDERING' and _to in ('COMPLETED','FAILED','CANCELLED'))
    or (_from = 'FAILED' and _to in ('READY','CANCELLED'))
    or (_from = 'CANCELLED' and _to = 'DRAFT');
$$;

create or replace function public.creator_studio_guard_project()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_seller uuid;
  v_creative_changed boolean := false;
begin
  if tg_op = 'UPDATE' and new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'creator_studio_owner_immutable';
  end if;

  if new.source_product_id is not null then
    select seller_id into v_seller
    from public.marketplace_products
    where id = new.source_product_id;

    if v_seller is null or v_seller <> new.owner_user_id then
      raise exception 'creator_studio_source_product_not_owned';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    v_creative_changed :=
      new.source_product_id is distinct from old.source_product_id
      or new.project_type is distinct from old.project_type
      or new.product_title is distinct from old.product_title
      or new.duration_seconds is distinct from old.duration_seconds
      or new.aspect_ratio is distinct from old.aspect_ratio
      or new.style_key is distinct from old.style_key
      or new.hook is distinct from old.hook
      or new.cta is distinct from old.cta
      or new.destination_url is distinct from old.destination_url
      or new.price_cents is distinct from old.price_cents
      or new.currency is distinct from old.currency
      or new.metadata is distinct from old.metadata;

    if old.status = 'READY' and new.status = 'READY' and v_creative_changed then
      new.status := 'DRAFT';
    end if;

    if not public.creator_studio_valid_transition(old.status, new.status) then
      raise exception 'creator_studio_invalid_transition:%->%', old.status, new.status;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger creator_studio_guard_project_before_write
before insert or update on public.creator_studio_projects
for each row execute function public.creator_studio_guard_project();

create or replace function public.creator_studio_validate_ready()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_has_cover boolean;
begin
  if new.status <> 'READY' or (tg_op = 'UPDATE' and old.status = 'READY') then
    return new;
  end if;

  if nullif(btrim(coalesce(new.product_title, '')), '') is null then
    raise exception 'creator_studio_ready_requires_product_title';
  end if;
  if nullif(btrim(coalesce(new.hook, '')), '') is null then
    raise exception 'creator_studio_ready_requires_hook';
  end if;
  if nullif(btrim(coalesce(new.cta, '')), '') is null then
    raise exception 'creator_studio_ready_requires_cta';
  end if;

  select exists (
    select 1
    from public.creator_studio_project_assets pa
    join public.creator_studio_assets a on a.id = pa.asset_id
    where pa.project_id = new.id
      and pa.owner_user_id = new.owner_user_id
      and a.owner_user_id = new.owner_user_id
      and a.category = 'PRODUCT_COVER'
      and a.state = 'READY'
  ) or exists (
    select 1
    from public.marketplace_products mp
    where mp.id = new.source_product_id
      and mp.seller_id = new.owner_user_id
      and nullif(btrim(coalesce(mp.cover_url, '')), '') is not null
  ) into v_has_cover;

  if not v_has_cover then
    raise exception 'creator_studio_ready_requires_cover';
  end if;

  return new;
end;
$$;

create trigger creator_studio_validate_ready_before_write
before insert or update of status on public.creator_studio_projects
for each row execute function public.creator_studio_validate_ready();

create or replace function public.creator_studio_audit_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.creator_studio_events (
      owner_user_id, project_id, event_type, entity_id, metadata
    ) values (
      new.owner_user_id, new.id, 'PROJECT_CREATED', new.id,
      jsonb_build_object('project_type', new.project_type)
    );
  else
    if new.status is distinct from old.status then
      insert into public.creator_studio_events (
        owner_user_id, project_id, event_type, entity_id, metadata
      ) values (
        new.owner_user_id, new.id, 'PROJECT_STATUS_CHANGED', new.id,
        jsonb_build_object('from', old.status, 'to', new.status)
      );
    end if;
    if new.source_product_id is distinct from old.source_product_id then
      insert into public.creator_studio_events (
        owner_user_id, project_id, event_type, entity_id, metadata
      ) values (
        new.owner_user_id, new.id, 'SOURCE_PRODUCT_CHANGED', new.id,
        jsonb_build_object('source_product_id', new.source_product_id)
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger creator_studio_audit_project_after_write
after insert or update on public.creator_studio_projects
for each row execute function public.creator_studio_audit_project();

alter table public.creator_studio_projects enable row level security;
alter table public.creator_studio_assets enable row level security;
alter table public.creator_studio_project_assets enable row level security;
alter table public.creator_studio_events enable row level security;

revoke all on table public.creator_studio_projects from anon, authenticated;
revoke all on table public.creator_studio_assets from anon, authenticated;
revoke all on table public.creator_studio_project_assets from anon, authenticated;
revoke all on table public.creator_studio_events from anon, authenticated;

grant select, insert, update on table public.creator_studio_projects to authenticated;
grant select on table public.creator_studio_assets to authenticated;
grant select on table public.creator_studio_project_assets to authenticated;
grant select on table public.creator_studio_events to authenticated;

create policy creator_studio_projects_select_owner
on public.creator_studio_projects for select to authenticated
using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy creator_studio_projects_insert_owner
on public.creator_studio_projects for insert to authenticated
with check (
  (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  and status = 'DRAFT'
);

create policy creator_studio_projects_update_owner
on public.creator_studio_projects for update to authenticated
using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (
  (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  and status in ('DRAFT','READY','CANCELLED')
);

create policy creator_studio_assets_select_owner
on public.creator_studio_assets for select to authenticated
using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy creator_studio_project_assets_select_owner
on public.creator_studio_project_assets for select to authenticated
using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy creator_studio_events_select_owner
on public.creator_studio_events for select to authenticated
using (owner_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create or replace function public.creator_studio_reserve_asset(
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
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_count integer;
  v_limit integer;
begin
  if v_user is null then
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

  if v_owner is null or (v_owner <> v_user and not public.has_role(v_user, 'admin')) then
    raise exception 'creator_studio_project_not_found';
  end if;
  if v_status not in ('DRAFT','READY') then
    raise exception 'creator_studio_project_locked';
  end if;
  if _storage_path not like v_owner::text || '/' || _project_id::text || '/' || _asset_id::text || '/%' then
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
    jsonb_build_object('category', _category, 'byte_size', _byte_size)
  );

  return _asset_id;
end;
$$;

create or replace function public.creator_studio_release_reserved_asset(_asset_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_project uuid;
  v_state text;
begin
  select a.owner_user_id, pa.project_id, a.state
    into v_owner, v_project, v_state
  from public.creator_studio_assets a
  join public.creator_studio_project_assets pa on pa.asset_id = a.id
  where a.id = _asset_id;

  if v_owner is null or v_user is null
    or (v_owner <> v_user and not public.has_role(v_user, 'admin')) then
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

create or replace function public.creator_studio_complete_asset(
  _asset_id uuid,
  _width integer default null,
  _height integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_project uuid;
begin
  select a.owner_user_id, pa.project_id
    into v_owner, v_project
  from public.creator_studio_assets a
  join public.creator_studio_project_assets pa on pa.asset_id = a.id
  where a.id = _asset_id and a.state = 'PENDING_UPLOAD'
  for update of a;

  if v_owner is null or v_user is null
    or (v_owner <> v_user and not public.has_role(v_user, 'admin')) then
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

create or replace function public.creator_studio_remove_asset(_asset_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
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

  if v_owner is null or v_user is null
    or (v_owner <> v_user and not public.has_role(v_user, 'admin')) then
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

revoke all on function public.creator_studio_reserve_asset(uuid,uuid,text,text,text,text,bigint) from public, anon;
revoke all on function public.creator_studio_release_reserved_asset(uuid) from public, anon;
revoke all on function public.creator_studio_complete_asset(uuid,integer,integer) from public, anon;
revoke all on function public.creator_studio_remove_asset(uuid) from public, anon;
grant execute on function public.creator_studio_reserve_asset(uuid,uuid,text,text,text,text,bigint) to authenticated;
grant execute on function public.creator_studio_release_reserved_asset(uuid) to authenticated;
grant execute on function public.creator_studio_complete_asset(uuid,integer,integer) to authenticated;
grant execute on function public.creator_studio_remove_asset(uuid) to authenticated;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'creator-studio-assets',
  'creator-studio-assets',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','video/mp4']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Deliberately no authenticated storage.objects policies for this bucket.
-- Uploads use short-lived server-issued signed upload tokens; reads use
-- short-lived server-issued signed URLs. The bucket remains private by default.
