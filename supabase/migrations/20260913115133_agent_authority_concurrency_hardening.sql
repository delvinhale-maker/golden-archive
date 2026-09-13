-- Agent Authority concurrency hardening validated against isolated staging.
-- 1) remove output-column ambiguity on already-resolved approval races.
-- 2) serialize EXECUTION receipt truth against Passport suspension/revocation/version cutover.

create or replace function public.resolve_agent_authority_approval_atomic(
  p_workspace_id uuid,
  p_approval_request_id uuid,
  p_approver_id uuid,
  p_decision text,
  p_note text default null
)
returns table(
  approval_request_id uuid,
  approval_status text,
  approval_decision_id uuid,
  approver_id uuid,
  note text,
  decided_at timestamptz,
  already_resolved boolean
)
language plpgsql
set search_path = public
as $$
declare
  v_request public.approval_requests%rowtype;
  v_decision public.approval_decisions%rowtype;
begin
  if p_decision not in ('APPROVED','REJECTED') then
    raise exception 'INVALID_APPROVAL_DECISION' using errcode = '22023';
  end if;

  select ar.* into v_request
  from public.approval_requests as ar
  where ar.id = p_approval_request_id
    and ar.workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'APPROVAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_request.status <> 'PENDING' then
    select ad.* into v_decision
    from public.approval_decisions as ad
    where ad.approval_request_id = v_request.id;

    return query
    select
      v_request.id,
      v_request.status,
      v_decision.id,
      v_decision.approver_id,
      v_decision.note,
      v_decision.decided_at,
      true;
    return;
  end if;

  if v_request.expires_at <= now() then
    update public.approval_requests as ar
    set status = 'EXPIRED', resolved_at = now(), resolved_by = null
    where ar.id = v_request.id;

    return query
    select v_request.id, 'EXPIRED'::text, null::uuid, null::uuid, null::text, now(), false;
    return;
  end if;

  insert into public.approval_decisions(workspace_id, approval_request_id, decision, approver_id, note)
  values (p_workspace_id, v_request.id, p_decision, p_approver_id, nullif(btrim(p_note), ''))
  returning * into v_decision;

  update public.approval_requests as ar
  set status = p_decision, resolved_at = v_decision.decided_at, resolved_by = p_approver_id
  where ar.id = v_request.id;

  return query
  select v_request.id, p_decision, v_decision.id, v_decision.approver_id, v_decision.note, v_decision.decided_at, false;
end;
$$;

revoke all on function public.resolve_agent_authority_approval_atomic(uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.resolve_agent_authority_approval_atomic(uuid,uuid,uuid,text,text) to service_role;

create or replace function public.enforce_agent_authority_receipt_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_request public.action_requests%rowtype;
  v_decision public.action_decisions%rowtype;
  v_passport public.agent_passports%rowtype;
  v_approval public.approval_requests%rowtype;
begin
  select ar.* into v_request
  from public.action_requests as ar
  where ar.id = new.action_request_id;
  if not found then
    raise exception 'RECEIPT_ACTION_REQUEST_NOT_FOUND' using errcode = '23503';
  end if;

  select ad.* into v_decision
  from public.action_decisions as ad
  where ad.id = new.decision_id;
  if not found then
    raise exception 'RECEIPT_DECISION_NOT_FOUND' using errcode = '23503';
  end if;

  if v_decision.action_request_id <> v_request.id
     or new.workspace_id <> v_request.workspace_id
     or new.workspace_id <> v_decision.workspace_id
     or new.passport_id <> v_request.passport_id
     or new.passport_id <> v_decision.passport_id
     or new.passport_version <> v_request.passport_version
     or new.passport_version <> v_decision.passport_version
     or new.policy_version <> v_decision.policy_version
     or new.policy_code <> v_decision.policy_code
     or new.action_key <> v_request.action_key
     or new.authority_result <> v_decision.decision then
    raise exception 'RECEIPT_POLICY_CONTEXT_MISMATCH' using errcode = '23514';
  end if;

  if new.requested_at <> v_request.requested_at then
    raise exception 'RECEIPT_REQUEST_TIMESTAMP_MISMATCH' using errcode = '23514';
  end if;

  if new.receipt_kind = 'EXECUTION' then
    -- FOR SHARE creates an ordering boundary with suspend/revoke/version UPDATEs.
    select ap.* into v_passport
    from public.agent_passports as ap
    where ap.id = new.passport_id
      and ap.workspace_id = new.workspace_id
    for share;

    if not found then
      raise exception 'EXECUTION_PASSPORT_NOT_FOUND' using errcode = '23503';
    end if;

    if v_passport.status <> 'AUTHORIZED' or v_passport.authorized_at is null then
      raise exception 'EXECUTION_PASSPORT_NOT_AUTHORIZED' using errcode = '23514';
    end if;

    if v_passport.authorization_expires_at is not null
       and v_passport.authorization_expires_at <= now() then
      raise exception 'EXECUTION_PASSPORT_AUTHORIZATION_EXPIRED' using errcode = '23514';
    end if;

    if v_passport.current_version <> v_decision.passport_version then
      raise exception 'EXECUTION_POLICY_VERSION_STALE' using errcode = '23514';
    end if;

    if v_decision.decision = 'BLOCK' then
      raise exception 'EXECUTION_BLOCKED_BY_POLICY' using errcode = '23514';
    end if;

    if v_decision.decision = 'APPROVAL_REQUIRED' then
      select apr.* into v_approval
      from public.approval_requests as apr
      where apr.action_request_id = v_request.id
      for share;

      if not found or v_approval.status <> 'APPROVED' then
        raise exception 'EXECUTION_APPROVAL_REQUIRED' using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;
