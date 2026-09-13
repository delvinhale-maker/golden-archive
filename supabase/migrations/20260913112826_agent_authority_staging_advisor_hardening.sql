-- Findings captured from isolated Agent Authority staging advisors.
-- Keep append-only trigger execution deterministic and optimize auth.uid() RLS evaluation.

alter function public.aa_prevent_append_only_mutation() set search_path = '';

drop policy if exists "aa membership self or admins" on public.agent_authority_members;
create policy "aa membership self or admins"
on public.agent_authority_members for select to authenticated
using (
  user_id = (select auth.uid())
  or private.agent_authority_has_role(workspace_id, array['OWNER','ADMIN'])
);
