-- Reusable local/staging RLS harness.
-- Run only after the Agent Authority migrations on an isolated Supabase database:
--   supabase test db supabase/tests/agent_authority_rls.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Deterministic synthetic users/workspaces. No real customer data.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-000000000001', 'aa-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000002', 'aa-admin@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000003', 'aa-approver@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000004', 'aa-auditor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000005', 'aa-member@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000099', 'aa-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.agent_authority_workspaces(id, name, created_by)
values
  ('10000000-0000-4000-8000-000000000001', 'Workspace Alpha', '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', 'Workspace Beta', '00000000-0000-4000-8000-000000000099');

insert into public.agent_authority_members(workspace_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','OWNER'),
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','ADMIN'),
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','APPROVER'),
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','AUDITOR'),
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005','MEMBER'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000099','OWNER');

insert into public.agent_passports(id, workspace_id, agent_name, human_sponsor, business_purpose, status, current_version, created_by)
values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Alpha Agent','Owner','Test','AUTHORIZED',1,'00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Beta Agent','Outsider','Test','AUTHORIZED',1,'00000000-0000-4000-8000-000000000099');

insert into public.agent_authority_audit_events(workspace_id, actor_user_id, event_type, resource_type, resource_id, metadata)
values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','test.event','passport','20000000-0000-4000-8000-000000000001','{}'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000099','test.event','passport','20000000-0000-4000-8000-000000000002','{}');

-- OWNER
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.agent_passports), 1::bigint, 'OWNER sees only own-workspace passports');
select is((select count(*) from public.agent_authority_audit_events), 1::bigint, 'OWNER can read own-workspace audit evidence');
select is((select count(*) from public.agent_authority_members), 5::bigint, 'OWNER can enumerate own workspace membership');
select throws_ok($$insert into public.agent_passports(workspace_id,agent_name,human_sponsor,business_purpose,created_by) values ('10000000-0000-4000-8000-000000000001','Browser write','x','x','00000000-0000-4000-8000-000000000001')$$, '42501', null, 'OWNER browser role cannot mutate governance tables');

-- ADMIN
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.agent_passports), 1::bigint, 'ADMIN sees own-workspace passport');
select is((select count(*) from public.agent_authority_audit_events), 1::bigint, 'ADMIN can read audit evidence');
select is((select count(*) from public.agent_authority_members), 5::bigint, 'ADMIN can enumerate workspace membership');

-- APPROVER
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.agent_passports), 1::bigint, 'APPROVER sees Passport configuration');
select is((select count(*) from public.agent_authority_audit_events), 0::bigint, 'APPROVER cannot read audit ledger');
select is((select count(*) from public.agent_authority_members), 1::bigint, 'APPROVER sees only own membership row');

-- AUDITOR
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
select is((select count(*) from public.agent_passports), 1::bigint, 'AUDITOR sees Passport configuration');
select is((select count(*) from public.agent_authority_audit_events), 1::bigint, 'AUDITOR can read audit ledger');
select is((select count(*) from public.agent_authority_members), 1::bigint, 'AUDITOR cannot enumerate other members');

-- MEMBER
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
select is((select count(*) from public.agent_passports), 1::bigint, 'MEMBER sees declared Passport configuration');
select is((select count(*) from public.agent_authority_audit_events), 0::bigint, 'MEMBER cannot read audit ledger');
select is((select count(*) from public.agent_authority_members), 1::bigint, 'MEMBER sees only own membership');

-- Cross-workspace outsider cannot infer Alpha data.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
select is((select count(*) from public.agent_passports where workspace_id='10000000-0000-4000-8000-000000000001'), 0::bigint, 'cross-workspace Passport read denied');
select is((select count(*) from public.agent_authority_audit_events where workspace_id='10000000-0000-4000-8000-000000000001'), 0::bigint, 'cross-workspace audit read denied');

-- Credential/rate-window tables do not expose SELECT to authenticated users at all.
select throws_ok($$select count(*) from public.agent_authority_api_keys$$, '42501', null, 'API key hashes are not client-readable');
select throws_ok($$select count(*) from public.agent_authority_api_rate_windows$$, '42501', null, 'rate windows are not client-readable');

select * from finish();
rollback;
