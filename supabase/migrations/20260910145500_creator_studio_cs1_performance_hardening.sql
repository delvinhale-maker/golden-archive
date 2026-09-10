-- AurumVault Creator Studio™ — CS1 performance hardening
-- Clear CS1-specific Supabase advisor findings without changing access semantics.

create index creator_studio_events_project_idx
  on public.creator_studio_events(project_id);

create index creator_studio_project_assets_asset_idx
  on public.creator_studio_project_assets(asset_id);

drop policy creator_studio_projects_select_owner on public.creator_studio_projects;
create policy creator_studio_projects_select_owner
on public.creator_studio_projects for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or (select public.has_role((select auth.uid()), 'admin'))
);

drop policy creator_studio_projects_insert_owner on public.creator_studio_projects;
create policy creator_studio_projects_insert_owner
on public.creator_studio_projects for insert to authenticated
with check (
  (
    owner_user_id = (select auth.uid())
    or (select public.has_role((select auth.uid()), 'admin'))
  )
  and status = 'DRAFT'
);

drop policy creator_studio_projects_update_owner on public.creator_studio_projects;
create policy creator_studio_projects_update_owner
on public.creator_studio_projects for update to authenticated
using (
  owner_user_id = (select auth.uid())
  or (select public.has_role((select auth.uid()), 'admin'))
)
with check (
  (
    owner_user_id = (select auth.uid())
    or (select public.has_role((select auth.uid()), 'admin'))
  )
  and status in ('DRAFT','READY','CANCELLED')
);

drop policy creator_studio_assets_select_owner on public.creator_studio_assets;
create policy creator_studio_assets_select_owner
on public.creator_studio_assets for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or (select public.has_role((select auth.uid()), 'admin'))
);

drop policy creator_studio_project_assets_select_owner on public.creator_studio_project_assets;
create policy creator_studio_project_assets_select_owner
on public.creator_studio_project_assets for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or (select public.has_role((select auth.uid()), 'admin'))
);

drop policy creator_studio_events_select_owner on public.creator_studio_events;
create policy creator_studio_events_select_owner
on public.creator_studio_events for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or (select public.has_role((select auth.uid()), 'admin'))
);
