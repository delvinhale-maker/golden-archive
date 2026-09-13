-- AurumVault AI Agent Authority Passport™
-- Detached schema package. Do not run against production without migration review.
-- All governance writes are intended to flow through authenticated server functions.

create extension if not exists pgcrypto;

create sequence if not exists agent_passport_code_seq start 1;
create sequence if not exists authorization_receipt_code_seq start 1;

create table if not exists agent_authority_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_authority_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER','ADMIN','APPROVER','AUDITOR','MEMBER')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists agent_passports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  passport_code text not null unique default ('AV-AGT-' || lpad(nextval('agent_passport_code_seq')::text, 5, '0')),
  agent_name text not null check (char_length(agent_name) between 1 and 160),
  human_sponsor text not null,
  department text,
  business_purpose text not null,
  provider text,
  model text,
  platform text,
  environment text not null default 'production' check (environment in ('development','staging','production','other')),
  status text not null default 'DRAFT' check (status in ('DRAFT','AUTHORIZED','SUSPENDED','EXPIRED','REVOKED')),
  current_version integer not null default 1 check (current_version >= 1),
  authorized_at timestamptz,
  authorization_expires_at timestamptz,
  last_review_at timestamptz,
  next_review_at timestamptz,
  review_cadence_days integer check (review_cadence_days in (30,60,90,180,365)),
  suspended_at timestamptz,
  suspended_by uuid references auth.users(id),
  suspension_reason text,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revocation_reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'AUTHORIZED') or authorized_at is not null),
  check ((status <> 'SUSPENDED') or (suspended_at is not null and suspension_reason is not null)),
  check ((status <> 'REVOKED') or (revoked_at is not null and revocation_reason is not null))
);

create table if not exists agent_passport_versions (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references agent_passports(id) on delete cascade,
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  version integer not null check (version >= 1),
  identity_snapshot jsonb not null default '{}'::jsonb,
  authority_snapshot jsonb not null default '{}'::jsonb,
  limits_snapshot jsonb not null default '{}'::jsonb,
  change_reason text,
  requires_reauthorization boolean not null default false,
  authorized_by uuid references auth.users(id),
  authorized_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (passport_id, version)
);

create table if not exists agent_permissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  passport_id uuid not null references agent_passports(id) on delete cascade,
  passport_version integer not null check (passport_version >= 1),
  action_key text not null check (action_key ~ '^[a-z0-9_.:-]+$'),
  label text not null,
  system_name text,
  category text,
  decision text not null check (decision in ('ALLOW','APPROVAL_REQUIRED','BLOCK')),
  approval_role text check (approval_role in ('OWNER','ADMIN','APPROVER')),
  approval_above_amount numeric(14,2) check (approval_above_amount is null or approval_above_amount >= 0),
  conditions jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (passport_id, passport_version, action_key)
);

create table if not exists agent_limits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  passport_id uuid not null references agent_passports(id) on delete cascade,
  passport_version integer not null check (passport_version >= 1),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  max_single_purchase numeric(14,2) check (max_single_purchase is null or max_single_purchase >= 0),
  max_daily_spend numeric(14,2) check (max_daily_spend is null or max_daily_spend >= 0),
  max_refund numeric(14,2) check (max_refund is null or max_refund >= 0),
  max_invoice numeric(14,2) check (max_invoice is null or max_invoice >= 0),
  external_communication_policy text not null default 'APPROVAL_REQUIRED' check (external_communication_policy in ('ALLOW','APPROVAL_REQUIRED','BLOCK')),
  financial_actions_policy text not null default 'BLOCK' check (financial_actions_policy in ('ALLOW','APPROVAL_REQUIRED','BLOCK')),
  sensitive_data_policy text not null default 'BLOCK' check (sensitive_data_policy in ('ALLOW','APPROVAL_REQUIRED','BLOCK')),
  high_risk_requires_approval boolean not null default true,
  allowed_systems text[] not null default '{}',
  blocked_systems text[] not null default '{}',
  custom_notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (passport_id, passport_version)
);

create table if not exists action_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  passport_id uuid not null references agent_passports(id) on delete restrict,
  passport_version integer not null,
  action_key text not null,
  target text,
  system_name text,
  amount numeric(14,2),
  amount_kind text check (amount_kind in ('PURCHASE','REFUND','INVOICE','OTHER')),
  currency text,
  external_communication boolean not null default false,
  financial_action boolean not null default false,
  sensitive_data boolean not null default false,
  high_risk boolean not null default false,
  context_metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  actor_type text not null default 'HUMAN' check (actor_type in ('HUMAN','API_KEY','SYSTEM')),
  requested_by uuid references auth.users(id),
  requested_via_api_key_id uuid,
  requested_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  check ((actor_type = 'HUMAN' and requested_by is not null) or (actor_type = 'API_KEY' and requested_via_api_key_id is not null) or actor_type = 'SYSTEM')
);

create table if not exists action_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  action_request_id uuid not null unique references action_requests(id) on delete restrict,
  passport_id uuid not null references agent_passports(id) on delete restrict,
  passport_version integer not null,
  decision text not null check (decision in ('ALLOW','APPROVAL_REQUIRED','BLOCK')),
  primary_reason text not null,
  reason_codes text[] not null default '{}',
  policy_code text not null,
  policy_version integer not null,
  decided_at timestamptz not null default now()
);

create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  action_request_id uuid not null unique references action_requests(id) on delete restrict,
  decision_id uuid not null references action_decisions(id) on delete restrict,
  assigned_role text not null default 'APPROVER' check (assigned_role in ('OWNER','ADMIN','APPROVER')),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','EXPIRED')),
  reason text,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

create table if not exists approval_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  approval_request_id uuid not null unique references approval_requests(id) on delete restrict,
  decision text not null check (decision in ('APPROVED','REJECTED')),
  approver_id uuid not null references auth.users(id),
  note text,
  decided_at timestamptz not null default now()
);

create table if not exists authorization_receipts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  receipt_code text not null unique default ('AV-' || lpad(nextval('authorization_receipt_code_seq')::text, 6, '0')),
  action_request_id uuid not null references action_requests(id) on delete restrict,
  decision_id uuid not null references action_decisions(id) on delete restrict,
  passport_id uuid not null references agent_passports(id) on delete restrict,
  passport_version integer not null,
  receipt_kind text not null check (receipt_kind in ('AUTHORIZATION','EXECUTION','TERMINAL')),
  action_key text not null,
  target text,
  authority_result text not null check (authority_result in ('ALLOW','APPROVAL_REQUIRED','BLOCK')),
  policy_code text not null,
  policy_version integer not null,
  human_approver_id uuid references auth.users(id),
  human_approved_at timestamptz,
  requested_at timestamptz not null,
  executed_at timestamptz,
  execution_status text,
  outcome text not null,
  evidence_level text not null check (evidence_level in ('DECLARED','APPROVAL_VERIFIED','EXECUTION_VERIFIED','SIGNED_EVIDENCE')),
  evidence_references jsonb not null default '[]'::jsonb,
  integrity_hash text not null check (integrity_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (action_request_id, receipt_kind),
  check ((evidence_level <> 'APPROVAL_VERIFIED') or (human_approver_id is not null and human_approved_at is not null)),
  check ((evidence_level not in ('EXECUTION_VERIFIED','SIGNED_EVIDENCE')) or executed_at is not null)
);

create table if not exists evidence_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  passport_id uuid references agent_passports(id) on delete restrict,
  action_request_id uuid references action_requests(id) on delete restrict,
  receipt_id uuid references authorization_receipts(id) on delete restrict,
  event_type text not null,
  actor_type text not null check (actor_type in ('HUMAN','AGENT','SYSTEM','INTEGRATION')),
  actor_user_id uuid references auth.users(id),
  source_system text,
  external_reference text,
  prior_status text,
  new_status text,
  metadata jsonb not null default '{}'::jsonb,
  integrity_hash text check (integrity_hash is null or integrity_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null default now()
);

create table if not exists authority_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  passport_id uuid not null references agent_passports(id) on delete restrict,
  passport_version integer not null,
  review_type text not null check (review_type in ('RECERTIFY','MODIFY_AND_REAUTHORIZE','SUSPEND','REVOKE')),
  reviewer_id uuid not null references auth.users(id),
  notes text,
  authority_snapshot jsonb not null,
  reviewed_at timestamptz not null default now(),
  next_review_at timestamptz
);

create table if not exists agent_authority_api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  name text not null,
  key_hash text not null unique check (key_hash ~ '^[a-f0-9]{64}$'),
  display_prefix text not null,
  last4 text not null check (char_length(last4) = 4),
  scopes text[] not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  check (scopes <@ array['passports:read','decisions:write','approvals:read','receipts:read','evidence:write','webhooks:manage']::text[])
);

alter table action_requests
  add constraint action_requests_api_key_fk
  foreign key (requested_via_api_key_id) references agent_authority_api_keys(id) on delete restrict;

create table if not exists agent_authority_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  url text not null check (url ~ '^https://'),
  subscribed_events text[] not null,
  active boolean not null default true,
  secret_reference text,
  secret_fingerprint text,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_delivery_status integer,
  last_delivery_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_authority_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  webhook_endpoint_id uuid not null references agent_authority_webhook_endpoints(id) on delete cascade,
  event_type text not null,
  event_reference uuid,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  response_status integer,
  delivered_at timestamptz,
  error_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_authority_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_agent_passports_workspace on agent_passports(workspace_id, status);
create index if not exists idx_agent_passports_reviews on agent_passports(workspace_id, next_review_at);
create index if not exists idx_action_requests_workspace_time on action_requests(workspace_id, requested_at desc);
create index if not exists idx_action_decisions_workspace_time on action_decisions(workspace_id, decided_at desc);
create index if not exists idx_approval_requests_workspace_status on approval_requests(workspace_id, status, expires_at);
create index if not exists idx_receipts_workspace_time on authorization_receipts(workspace_id, created_at desc);
create index if not exists idx_evidence_workspace_time on evidence_events(workspace_id, occurred_at desc);
create index if not exists idx_evidence_passport_time on evidence_events(passport_id, occurred_at desc);
create index if not exists idx_reviews_workspace_time on authority_reviews(workspace_id, reviewed_at desc);

-- RLS: exposed governance tables are readable only by members of the same workspace.
-- Mutations intentionally have no client-facing policies; trusted server functions perform
-- membership/role checks before using the server-only service client.
alter table agent_authority_workspaces enable row level security;
alter table agent_authority_members enable row level security;
alter table agent_passports enable row level security;
alter table agent_passport_versions enable row level security;
alter table agent_permissions enable row level security;
alter table agent_limits enable row level security;
alter table action_requests enable row level security;
alter table action_decisions enable row level security;
alter table approval_requests enable row level security;
alter table approval_decisions enable row level security;
alter table authorization_receipts enable row level security;
alter table evidence_events enable row level security;
alter table authority_reviews enable row level security;
alter table agent_authority_api_keys enable row level security;
alter table agent_authority_webhook_endpoints enable row level security;
alter table agent_authority_webhook_deliveries enable row level security;
alter table agent_authority_audit_events enable row level security;

create policy "aa members read own membership"
on agent_authority_members for select to authenticated
using ((select auth.uid()) = user_id);

create policy "aa members read workspace"
on agent_authority_workspaces for select to authenticated
using (exists (
  select 1 from agent_authority_members m
  where m.workspace_id = agent_authority_workspaces.id
    and m.user_id = (select auth.uid())
));

create policy "aa members read passports"
on agent_passports for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_passports.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read passport versions"
on agent_passport_versions for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_passport_versions.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read permissions"
on agent_permissions for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_permissions.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read limits"
on agent_limits for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_limits.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read action requests"
on action_requests for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = action_requests.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read decisions"
on action_decisions for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = action_decisions.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read approval requests"
on approval_requests for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = approval_requests.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read approval decisions"
on approval_decisions for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = approval_decisions.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read receipts"
on authorization_receipts for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = authorization_receipts.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read evidence"
on evidence_events for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = evidence_events.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read reviews"
on authority_reviews for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = authority_reviews.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read webhook endpoints"
on agent_authority_webhook_endpoints for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_authority_webhook_endpoints.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read webhook deliveries"
on agent_authority_webhook_deliveries for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_authority_webhook_deliveries.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read audit events"
on agent_authority_audit_events for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_authority_audit_events.workspace_id and m.user_id = (select auth.uid())));

-- Deliberately no SELECT policy on agent_authority_api_keys: even hashes are server-only.
-- Deliberately no anon policies anywhere in this package.

create or replace function agent_authority_prevent_immutable_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'immutable governance record: % cannot be changed', tg_table_name;
end;
$$;

revoke all on function agent_authority_prevent_immutable_change() from public;

create trigger action_requests_immutable before update or delete on action_requests
for each row execute function agent_authority_prevent_immutable_change();
create trigger action_decisions_immutable before update or delete on action_decisions
for each row execute function agent_authority_prevent_immutable_change();
create trigger approval_decisions_immutable before update or delete on approval_decisions
for each row execute function agent_authority_prevent_immutable_change();
create trigger authorization_receipts_immutable before update or delete on authorization_receipts
for each row execute function agent_authority_prevent_immutable_change();
create trigger evidence_events_immutable before update or delete on evidence_events
for each row execute function agent_authority_prevent_immutable_change();
create trigger authority_reviews_immutable before update or delete on authority_reviews
for each row execute function agent_authority_prevent_immutable_change();

comment on table agent_passports is 'AI Agent Authority Passport registry; human-readable passport_code is not an authorization secret.';
comment on table action_decisions is 'Immutable deterministic Action Gate results: ALLOW, APPROVAL_REQUIRED, or BLOCK.';
comment on table authorization_receipts is 'Immutable authorization/execution/terminal evidence snapshots with explicit evidence levels.';
comment on table evidence_events is 'Append-only Evidence Ledger. Never store raw credentials, tokens, or unnecessary sensitive payload bodies.';
comment on table agent_authority_api_keys is 'API credentials store only hashes plus non-secret display fragments; plaintext key is returned once at creation.';

-- ================================================================
-- Phase 1.5 governance hardening
-- Policy diff, least privilege, risk, shadow mode, incidents,
-- delegation, policy-change approval, API/webhook hardening,
-- data classification and readiness evidence.
-- ================================================================

alter table agent_passport_versions add column if not exists policy_diff jsonb not null default '{}'::jsonb;
alter table agent_passport_versions add column if not exists requires_policy_change_approval boolean not null default false;
alter table agent_permissions add column if not exists data_classification_policy jsonb not null default '{}'::jsonb;
alter table agent_limits add column if not exists data_classification_policy jsonb not null default '{}'::jsonb;
alter table action_requests add column if not exists data_classification text check (data_classification in ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED'));
alter table agent_authority_api_keys add column if not exists rate_limit_per_minute integer not null default 60 check (rate_limit_per_minute between 1 and 10000);
alter table agent_authority_api_keys add column if not exists rotated_from_key_id uuid references agent_authority_api_keys(id) on delete set null;
alter table agent_authority_webhook_endpoints add column if not exists consecutive_failures integer not null default 0 check (consecutive_failures >= 0);
alter table agent_authority_webhook_endpoints add column if not exists last_success_at timestamptz;
alter table agent_authority_webhook_deliveries add column if not exists state text not null default 'PENDING' check (state in ('PENDING','RETRY_SCHEDULED','DELIVERED','DEAD_LETTER'));
alter table agent_authority_webhook_deliveries add column if not exists next_attempt_at timestamptz;
alter table agent_authority_webhook_deliveries add column if not exists last_attempt_at timestamptz;
alter table agent_authority_webhook_deliveries add column if not exists dead_lettered_at timestamptz;
alter table agent_authority_webhook_deliveries add column if not exists replayed_from_delivery_id uuid references agent_authority_webhook_deliveries(id) on delete set null;
alter table agent_authority_webhook_deliveries add column if not exists payload_hash text check (payload_hash is null or payload_hash ~ '^[a-f0-9]{64}$');
alter table agent_authority_webhook_deliveries add column if not exists signature_fingerprint text;

create table if not exists agent_data_classifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  resource_key text not null check (char_length(resource_key) between 1 and 240),
  system_name text,
  display_name text not null,
  classification text not null check (classification in ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED')),
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, resource_key)
);

create table if not exists agent_shadow_simulations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  passport_id uuid not null references agent_passports(id) on delete cascade,
  passport_version integer not null,
  requested_by uuid not null references auth.users(id),
  request_payload jsonb not null,
  simulated_decision text not null check (simulated_decision in ('ALLOW','APPROVAL_REQUIRED','BLOCK')),
  reason_codes text[] not null default '{}',
  executable boolean not null default false check (executable = false),
  simulated_at timestamptz not null default now()
);

create table if not exists agent_policy_change_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  passport_id uuid not null references agent_passports(id) on delete cascade,
  from_version integer not null check (from_version >= 1),
  to_version integer not null check (to_version > from_version),
  change_reason text not null,
  diff jsonb not null,
  has_material_increase boolean not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','EXPIRED')),
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_note text,
  unique (passport_id, to_version)
);

create table if not exists agent_incidents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  passport_id uuid references agent_passports(id) on delete set null,
  incident_code text not null unique default ('AV-INC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  title text not null check (char_length(title) between 3 and 240),
  severity text not null check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  status text not null default 'OPEN' check (status in ('OPEN','CONTAINED','INVESTIGATING','REMEDIATING','RESOLVED','CLOSED')),
  summary text not null,
  containment_summary text,
  root_cause text,
  corrective_actions jsonb not null default '[]'::jsonb,
  owner_user_id uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  contained_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_incident_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  incident_id uuid not null references agent_incidents(id) on delete cascade,
  passport_id uuid references agent_passports(id) on delete set null,
  event_type text not null,
  actor_user_id uuid references auth.users(id),
  prior_status text,
  new_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  integrity_hash text not null check (integrity_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null default now()
);

create table if not exists agent_delegations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  delegator_user_id uuid not null references auth.users(id),
  delegate_user_id uuid not null references auth.users(id),
  parent_delegation_id uuid references agent_delegations(id) on delete set null,
  purpose text not null,
  can_approve_actions boolean not null default true,
  can_redelegate boolean not null default false,
  action_keys text[] not null default '{}',
  max_approval_amount numeric(14,2) check (max_approval_amount is null or max_approval_amount >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','EXPIRED','REVOKED')),
  created_by uuid not null references auth.users(id),
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  check (delegate_user_id <> delegator_user_id),
  check (ends_at > starts_at)
);

create table if not exists agent_delegation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  delegation_id uuid not null references agent_delegations(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references auth.users(id),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  integrity_hash text not null check (integrity_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null default now()
);

create table if not exists agent_governance_analyses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agent_authority_workspaces(id) on delete cascade,
  passport_id uuid references agent_passports(id) on delete cascade,
  passport_version integer,
  analysis_type text not null check (analysis_type in ('RISK_SCORE','LEAST_PRIVILEGE','READINESS')),
  score integer check (score is null or score between 0 and 100),
  band text,
  payload jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists agent_authority_api_rate_windows (
  api_key_id uuid not null references agent_authority_api_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (api_key_id, window_start)
);

create or replace function consume_agent_authority_rate_limit(p_api_key_id uuid, p_limit integer)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('minute', now());
  v_count integer;
begin
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid rate limit';
  end if;

  insert into agent_authority_api_rate_windows(api_key_id, window_start, request_count)
  values (p_api_key_id, v_window, 1)
  on conflict (api_key_id, window_start)
  do update set request_count = agent_authority_api_rate_windows.request_count + 1
  returning request_count into v_count;

  return query select
    v_count <= p_limit,
    greatest(0, p_limit - v_count),
    v_window + interval '1 minute';
end;
$$;
revoke all on function consume_agent_authority_rate_limit(uuid, integer) from public, anon, authenticated;
grant execute on function consume_agent_authority_rate_limit(uuid, integer) to service_role;

-- Atomic endpoint health updates prevent lost failure increments when multiple delivery workers run.
create or replace function update_agent_authority_webhook_endpoint_health(
  p_endpoint_id uuid,
  p_response_status integer,
  p_delivered boolean
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_delivered then
    update agent_authority_webhook_endpoints
      set last_delivery_status = p_response_status,
          last_delivery_at = now(),
          last_success_at = now(),
          consecutive_failures = 0,
          updated_at = now()
      where id = p_endpoint_id;
  else
    update agent_authority_webhook_endpoints
      set last_delivery_status = p_response_status,
          last_delivery_at = now(),
          failure_count = failure_count + 1,
          consecutive_failures = consecutive_failures + 1,
          updated_at = now()
      where id = p_endpoint_id;
  end if;
end;
$$;
revoke all on function update_agent_authority_webhook_endpoint_health(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function update_agent_authority_webhook_endpoint_health(uuid, integer, boolean) to service_role;

create index if not exists idx_agent_data_classifications_workspace on agent_data_classifications(workspace_id, classification);
create index if not exists idx_shadow_simulations_workspace_time on agent_shadow_simulations(workspace_id, simulated_at desc);
create index if not exists idx_policy_changes_workspace_status on agent_policy_change_requests(workspace_id, status, requested_at desc);
create index if not exists idx_incidents_workspace_status on agent_incidents(workspace_id, status, severity);
create index if not exists idx_incident_events_incident_time on agent_incident_events(incident_id, occurred_at desc);
create index if not exists idx_delegations_delegate_active on agent_delegations(workspace_id, delegate_user_id, status, starts_at, ends_at);
create index if not exists idx_governance_analyses_workspace on agent_governance_analyses(workspace_id, analysis_type, created_at desc);
create index if not exists idx_webhook_deliveries_retry on agent_authority_webhook_deliveries(state, next_attempt_at) where state = 'RETRY_SCHEDULED';
create unique index if not exists idx_webhook_delivery_single_replay on agent_authority_webhook_deliveries(replayed_from_delivery_id) where replayed_from_delivery_id is not null;

alter table agent_data_classifications enable row level security;
alter table agent_shadow_simulations enable row level security;
alter table agent_policy_change_requests enable row level security;
alter table agent_incidents enable row level security;
alter table agent_incident_events enable row level security;
alter table agent_delegations enable row level security;
alter table agent_delegation_events enable row level security;
alter table agent_governance_analyses enable row level security;
alter table agent_authority_api_rate_windows enable row level security;

create policy "aa members read data classifications"
on agent_data_classifications for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_data_classifications.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read shadow simulations"
on agent_shadow_simulations for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_shadow_simulations.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read policy changes"
on agent_policy_change_requests for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_policy_change_requests.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read incidents"
on agent_incidents for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_incidents.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read incident events"
on agent_incident_events for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_incident_events.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read delegations"
on agent_delegations for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_delegations.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read delegation events"
on agent_delegation_events for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_delegation_events.workspace_id and m.user_id = (select auth.uid())));

create policy "aa members read governance analyses"
on agent_governance_analyses for select to authenticated
using (exists (select 1 from agent_authority_members m where m.workspace_id = agent_governance_analyses.workspace_id and m.user_id = (select auth.uid())));

-- No authenticated SELECT policy is intentionally created for API rate windows.
-- They are operational security records accessed only by the server role.

create or replace function aa_prevent_append_only_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;
revoke all on function aa_prevent_append_only_mutation() from public;

create trigger aa_shadow_simulations_append_only before update or delete on agent_shadow_simulations for each row execute function aa_prevent_append_only_mutation();
create trigger aa_incident_events_append_only before update or delete on agent_incident_events for each row execute function aa_prevent_append_only_mutation();
create trigger aa_delegation_events_append_only before update or delete on agent_delegation_events for each row execute function aa_prevent_append_only_mutation();
create trigger aa_governance_analyses_append_only before update or delete on agent_governance_analyses for each row execute function aa_prevent_append_only_mutation();
