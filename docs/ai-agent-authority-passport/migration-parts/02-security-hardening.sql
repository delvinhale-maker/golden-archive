-- Agent Authority security hardening applied after the foundation schema.
-- This file is copied into a Supabase-CLI-generated migration by the migration packaging gate.

-- ------------------------------------------------------------------
-- Explicit table privileges: browser clients are read-only by default.
-- All governance mutations continue through authenticated server functions
-- using the service role after application-level membership/authority checks.
-- ------------------------------------------------------------------
revoke all on table
  agent_authority_workspaces,
  agent_authority_members,
  agent_passports,
  agent_passport_versions,
  agent_permissions,
  agent_limits,
  action_requests,
  action_decisions,
  approval_requests,
  approval_decisions,
  authorization_receipts,
  evidence_events,
  authority_reviews,
  agent_authority_api_keys,
  agent_authority_webhook_endpoints,
  agent_authority_webhook_deliveries,
  agent_authority_audit_events,
  agent_data_classifications,
  agent_shadow_simulations,
  agent_policy_change_requests,
  agent_incidents,
  agent_incident_events,
  agent_delegations,
  agent_delegation_events,
  agent_governance_analyses,
  agent_authority_api_rate_windows
from anon, authenticated;

grant select on table
  agent_authority_workspaces,
  agent_authority_members,
  agent_passports,
  agent_passport_versions,
  agent_permissions,
  agent_limits,
  action_requests,
  action_decisions,
  approval_requests,
  approval_decisions,
  authorization_receipts,
  evidence_events,
  authority_reviews,
  agent_authority_webhook_endpoints,
  agent_authority_webhook_deliveries,
  agent_authority_audit_events,
  agent_data_classifications,
  agent_shadow_simulations,
  agent_policy_change_requests,
  agent_incidents,
  agent_incident_events,
  agent_delegations,
  agent_delegation_events,
  agent_governance_analyses
  to authenticated;

-- API key hashes and rate windows stay server-only: no authenticated grant/policy.

-- ------------------------------------------------------------------
-- Role-aware membership helper. SECURITY DEFINER prevents policy recursion
-- on agent_authority_members while remaining scoped only to auth.uid().
-- ------------------------------------------------------------------
create or replace function public.agent_authority_has_role(
  p_workspace_id uuid,
  p_roles text[] default null
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agent_authority_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and (p_roles is null or m.role = any(p_roles))
  );
$$;
revoke all on function public.agent_authority_has_role(uuid, text[]) from public, anon;
grant execute on function public.agent_authority_has_role(uuid, text[]) to authenticated, service_role;

-- Replace broad member-read policies with least-privilege read policies.
drop policy if exists "aa members read own membership" on agent_authority_members;
drop policy if exists "aa members read workspace" on agent_authority_workspaces;
drop policy if exists "aa members read passports" on agent_passports;
drop policy if exists "aa members read passport versions" on agent_passport_versions;
drop policy if exists "aa members read permissions" on agent_permissions;
drop policy if exists "aa members read limits" on agent_limits;
drop policy if exists "aa members read action requests" on action_requests;
drop policy if exists "aa members read decisions" on action_decisions;
drop policy if exists "aa members read approval requests" on approval_requests;
drop policy if exists "aa members read approval decisions" on approval_decisions;
drop policy if exists "aa members read receipts" on authorization_receipts;
drop policy if exists "aa members read evidence" on evidence_events;
drop policy if exists "aa members read reviews" on authority_reviews;
drop policy if exists "aa members read webhook endpoints" on agent_authority_webhook_endpoints;
drop policy if exists "aa members read webhook deliveries" on agent_authority_webhook_deliveries;
drop policy if exists "aa members read audit events" on agent_authority_audit_events;
drop policy if exists "aa members read data classifications" on agent_data_classifications;
drop policy if exists "aa members read shadow simulations" on agent_shadow_simulations;
drop policy if exists "aa members read policy changes" on agent_policy_change_requests;
drop policy if exists "aa members read incidents" on agent_incidents;
drop policy if exists "aa members read incident events" on agent_incident_events;
drop policy if exists "aa members read delegations" on agent_delegations;
drop policy if exists "aa members read delegation events" on agent_delegation_events;
drop policy if exists "aa members read governance analyses" on agent_governance_analyses;

create policy "aa membership self or admins"
on agent_authority_members for select to authenticated
using (
  user_id = auth.uid()
  or public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN'])
);

create policy "aa workspace members"
on agent_authority_workspaces for select to authenticated
using (public.agent_authority_has_role(id, null));

-- All roles may see the Passport's declared identity/authority configuration.
create policy "aa passport members" on agent_passports for select to authenticated using (public.agent_authority_has_role(workspace_id, null));
create policy "aa passport versions members" on agent_passport_versions for select to authenticated using (public.agent_authority_has_role(workspace_id, null));
create policy "aa permissions members" on agent_permissions for select to authenticated using (public.agent_authority_has_role(workspace_id, null));
create policy "aa limits members" on agent_limits for select to authenticated using (public.agent_authority_has_role(workspace_id, null));
create policy "aa classifications members" on agent_data_classifications for select to authenticated using (public.agent_authority_has_role(workspace_id, null));

-- Operational action/approval data is available to administrators, approvers and auditors.
create policy "aa action requests operational roles" on action_requests for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','APPROVER','AUDITOR']));
create policy "aa action decisions operational roles" on action_decisions for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','APPROVER','AUDITOR']));
create policy "aa approval requests operational roles" on approval_requests for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','APPROVER','AUDITOR']));
create policy "aa approval decisions operational roles" on approval_decisions for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','APPROVER','AUDITOR']));

-- Evidence, reviews and audit data are for governance/audit roles only.
create policy "aa receipts audit roles" on authorization_receipts for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','AUDITOR']));
create policy "aa evidence audit roles" on evidence_events for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','AUDITOR']));
create policy "aa reviews audit roles" on authority_reviews for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','AUDITOR']));
create policy "aa audit events audit roles" on agent_authority_audit_events for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','AUDITOR']));
create policy "aa analyses audit roles" on agent_governance_analyses for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','AUDITOR']));

-- Simulations/policy changes/incidents/delegations are governance operations.
create policy "aa shadow simulations governance roles" on agent_shadow_simulations for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','APPROVER','AUDITOR']));
create policy "aa policy changes governance roles" on agent_policy_change_requests for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','APPROVER','AUDITOR']));
create policy "aa incidents governance roles" on agent_incidents for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','APPROVER','AUDITOR']));
create policy "aa incident events governance roles" on agent_incident_events for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','APPROVER','AUDITOR']));
create policy "aa delegations governance roles" on agent_delegations for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','APPROVER','AUDITOR']));
create policy "aa delegation events governance roles" on agent_delegation_events for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','APPROVER','AUDITOR']));

-- Integration/webhook operational metadata is admin/auditor only.
create policy "aa webhook endpoints admin audit" on agent_authority_webhook_endpoints for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','AUDITOR']));
create policy "aa webhook deliveries admin audit" on agent_authority_webhook_deliveries for select to authenticated using (public.agent_authority_has_role(workspace_id, array['OWNER','ADMIN','AUDITOR']));

-- ------------------------------------------------------------------
-- Atomic approval resolution. The application proves role/delegation first;
-- this service-role-only RPC serializes the pending-state claim + immutable
-- approval_decision insert so simultaneous approvers cannot create conflicts.
-- ------------------------------------------------------------------
create or replace function public.resolve_agent_authority_approval_atomic(
  p_workspace_id uuid,
  p_approval_request_id uuid,
  p_approver_id uuid,
  p_decision text,
  p_note text default null
) returns table(
  approval_request_id uuid,
  approval_status text,
  approval_decision_id uuid,
  approver_id uuid,
  note text,
  decided_at timestamptz,
  already_resolved boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.approval_requests%rowtype;
  v_decision public.approval_decisions%rowtype;
begin
  if p_decision not in ('APPROVED','REJECTED') then
    raise exception 'INVALID_APPROVAL_DECISION' using errcode = '22023';
  end if;

  select * into v_request
  from public.approval_requests
  where id = p_approval_request_id and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'APPROVAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_request.status <> 'PENDING' then
    select * into v_decision from public.approval_decisions where approval_request_id = v_request.id;
    return query select v_request.id, v_request.status, v_decision.id, v_decision.approver_id, v_decision.note, v_decision.decided_at, true;
    return;
  end if;

  if v_request.expires_at <= now() then
    update public.approval_requests
      set status = 'EXPIRED', resolved_at = now(), resolved_by = null
      where id = v_request.id;
    return query select v_request.id, 'EXPIRED'::text, null::uuid, null::uuid, null::text, now(), false;
    return;
  end if;

  insert into public.approval_decisions(workspace_id, approval_request_id, decision, approver_id, note)
  values (p_workspace_id, v_request.id, p_decision, p_approver_id, nullif(btrim(p_note), ''))
  returning * into v_decision;

  update public.approval_requests
    set status = p_decision, resolved_at = v_decision.decided_at, resolved_by = p_approver_id
    where id = v_request.id;

  return query select v_request.id, p_decision, v_decision.id, v_decision.approver_id, v_decision.note, v_decision.decided_at, false;
end;
$$;
revoke all on function public.resolve_agent_authority_approval_atomic(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_agent_authority_approval_atomic(uuid, uuid, uuid, text, text) to service_role;

-- Policy-version consistency: every action decision must stay bound to the same
-- Passport/version recorded by its request. This blocks accidental cross-version receipts.
create or replace function public.enforce_agent_authority_decision_version()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_request public.action_requests%rowtype;
begin
  select * into v_request from public.action_requests where id = new.action_request_id;
  if not found or v_request.workspace_id <> new.workspace_id or v_request.passport_id <> new.passport_id or v_request.passport_version <> new.passport_version or new.policy_version <> v_request.passport_version then
    raise exception 'POLICY_VERSION_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_agent_authority_decision_version() from public;
drop trigger if exists aa_action_decision_version_guard on public.action_decisions;
create trigger aa_action_decision_version_guard before insert on public.action_decisions
for each row execute function public.enforce_agent_authority_decision_version();

-- No client mutations should ever be granted later by accident.
-- The release gate statically asserts these grants and the service-role-only RPC grants.
