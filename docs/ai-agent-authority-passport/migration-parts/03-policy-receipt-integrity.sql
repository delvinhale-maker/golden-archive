-- Agent Authority policy/receipt integrity hardening.
-- Apply only after foundation + security-hardening migrations.

create or replace function public.enforce_agent_authority_receipt_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_request public.action_requests%rowtype;
  v_decision public.action_decisions%rowtype;
begin
  select * into v_request
  from public.action_requests
  where id = new.action_request_id;
  if not found then
    raise exception 'RECEIPT_ACTION_REQUEST_NOT_FOUND' using errcode = '23503';
  end if;

  select * into v_decision
  from public.action_decisions
  where id = new.decision_id;
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

  return new;
end;
$$;
revoke all on function public.enforce_agent_authority_receipt_integrity() from public, anon, authenticated;
grant execute on function public.enforce_agent_authority_receipt_integrity() to service_role;

drop trigger if exists aa_receipt_policy_integrity_guard on public.authorization_receipts;
create trigger aa_receipt_policy_integrity_guard
before insert on public.authorization_receipts
for each row execute function public.enforce_agent_authority_receipt_integrity();

-- Approval requests must remain bound to the same immutable decision/request pair.
create or replace function public.enforce_agent_authority_approval_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_decision public.action_decisions%rowtype;
begin
  select * into v_decision
  from public.action_decisions
  where id = new.decision_id;
  if not found
     or v_decision.action_request_id <> new.action_request_id
     or v_decision.workspace_id <> new.workspace_id
     or v_decision.decision <> 'APPROVAL_REQUIRED' then
    raise exception 'APPROVAL_POLICY_CONTEXT_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_agent_authority_approval_context() from public, anon, authenticated;
grant execute on function public.enforce_agent_authority_approval_context() to service_role;

drop trigger if exists aa_approval_policy_context_guard on public.approval_requests;
create trigger aa_approval_policy_context_guard
before insert on public.approval_requests
for each row execute function public.enforce_agent_authority_approval_context();
