# AurumVault Staging — Migration Applicability Report

Date: 2026-09-15
Target only: `aurumvault-staging` (`ypelutaddlibqvpaekyq`)
Recovery branch: `migration/aurumvault-lovable-exit`
Lovable source anchor: `c78b3ca13b27e0563a6bb01c270bef10407b82db`

> **READ-ONLY PRECHECK. NO MIGRATIONS HAVE BEEN APPLIED BY THIS RECOVERY WORK.**
>
> **APPLY GATE: NO-GO** until every required preflight query can be rerun successfully and every BLOCKED/UNKNOWN item below is cleared. Production is out of scope.

## 1. Verified staging facts from the successful read-only inspection

The last successful staging inspection established these facts before any migration write:

- `public.has_role(_user_id uuid, _role app_role)` exists.
- `public.touch_updated_at()` exists.
- `app_role` includes `admin`, `seller`, and `buyer`.
- `storage.foldername(name text)` exists.
- `public.marketplace_products` exists with `id uuid` and `seller_id uuid`.
- `storage.objects` exists.
- `public.audiobook_projects` did **not** exist at inspection time.
- `public.license_wallet_documents` did **not** exist at inspection time.

Those results reduce collision risk for the two primary feature foundations, but they are not enough to authorize migration execution.

## 2. Current inspection limitation

Follow-up read-only calls to `aurumvault-staging` are currently returning an upstream connector HTTP 502. The failure affects even `select 1` and project-status reads. Because of that outage, this report cannot currently re-confirm:

- `public.set_updated_at_timestamp()`;
- current storage buckets and bucket privacy settings;
- all `audiobook_%`, `license_wallet_%`, and `rights_%` tables/types;
- existing policies and triggers with the migration's target names;
- installed extensions (`pg_cron`, `pg_net`, etc.);
- `supabase_migrations.schema_migrations` history;
- current Product SEO columns/constraints on `marketplace_products`.

No inference from the 502 is being treated as evidence that an object is absent.

## 3. Migration matrix

| Order | Migration | Feature | Primary prerequisites | Current staging collision/applicability status |
|---:|---|---|---|---|
| 0 | prerequisite verification / independent bucket bootstrap | shared | auth schema, `has_role`, update timestamp helper(s), storage schema | **BLOCKED** — follow-up read-only inspection unavailable |
| 1 | `20260902151330_c00d942f-4e86-4650-baab-34781a4fcae1.sql` | Audiobook foundation | `auth.users`, `marketplace_products`, `app_role`, `has_role`, `set_updated_at_timestamp()`, `storage.objects`, `storage.foldername`, private Audiobook buckets | **BLOCKED** — `audiobook_projects` was absent, but helper/bucket/policy collision checks remain |
| 2 | `20260902151736_82a4b826-7571-4546-b41b-d6b6b28ec4c1.sql` | Audiobook owner-consistency hardening | order 1 tables | **WAITING ON 1** |
| 3 | `20260902151848_986fc369-9419-4efa-9eea-eeec20c39da9.sql` | Audiobook corrected owner-consistency function | order 2 function/triggers | **WAITING ON 2** |
| 4 | `20260902172329_1c659ce2-f10c-4a2f-81e2-8f1401bd25fa.sql` | License Wallet foundation | `storage.objects`, `storage.foldername`, private `license-wallet-documents` bucket | **BLOCKED** — `license_wallet_documents` was absent, but bucket/policy collision checks remain |
| 5 | `20260902210820_e6cfc89d-43e5-4956-8b55-b9e7668cccee.sql` | Wallet reminder offsets | order 4 reminder settings table | **WAITING ON 4** |
| — | `20260902213142_f8dffe65-c985-4f29-ba77-80405c3dd48b.sql` | Wallet Lovable scheduler | Lovable-hosted endpoint + embedded credential | **QUARANTINED / DO NOT APPLY** |
| 6 | `20260903020511_5ee36486-89fa-48a6-8550-be24c54f0eca.sql` | Wallet Stripe billing columns/events | order 4 entitlement table | **WAITING ON 4** |
| 7 | `20260907182244_02121ac7-993f-402b-bc7b-c467b12d6b79.sql` | Rights Passport foundation | `auth.users`, `app_role`, `has_role`, `touch_updated_at()` | **CONDITIONAL** — helper prerequisites verified earlier; target-object collision inspection still required |
| 8 | `20260907182425_c1fe2e66-0e34-4517-a9cd-cac3259d3177.sql` | Rights workspace/AI/license/evidence/flags | order 7 passport/assets | **WAITING ON 7** |
| 9 | `20260907182634_631cad06-c9ea-4e60-8185-5944aa911ec2.sql` | Rights document parsing/analysis workspace | orders 7–8 | **WAITING ON 8** |
| 10 | `20260907182801_243e9d6a-e355-4763-b8bc-71a8e386c294.sql` | Rights public identity/snapshot layer | prior Rights objects | **WAITING ON 9** |
| 11 | `20260907182844_6b61a8ea-e676-4779-a1b0-a8aaa7001c57.sql` | Rights entitlements/plans | `auth.users`, `has_role`, `touch_updated_at()` | **WAITING / collision check required** |
| 12 | `20260907182928_7b801b83-72b5-4df2-a08f-4c367eaed603.sql` | Rights append-only events | prior Rights passport lineage | **WAITING ON RIGHTS CHAIN** |
| 13 | `20260907183018_32debdf6-5b5e-48a7-9139-afccd324ebe2.sql` | Rights RLS policy hardening | all referenced Rights tables from prior steps | **WAITING ON 7–12** |
| 14 | `20260911120000_product_seo_phase2_metadata.sql` | Product SEO Phase 2 | existing `marketplace_products` | **CONDITIONAL** — additive `IF NOT EXISTS` columns, but existing SEO columns/constraint definitions must be inspected first |

## 4. Storage prerequisites

The recovered Audiobook and Wallet foundation migrations create storage policies against named buckets, but they do **not** create the buckets themselves.

Before order 1 or order 4 can run, staging must confirm or create, in a separate staging-only bootstrap migration:

- `audiobook-manuscripts` — private;
- `audiobook-audio` — private;
- `license-wallet-documents` — private;
- `product-covers` — existing/compatible, because Audiobook metadata reuses it for cover paths.

Bucket creation must be explicit and idempotent. It must not be hidden inside a policy migration after the fact.

## 5. Audiobook dependency notes

The Phase 1 Audiobook migration creates its enums/tables/RLS/policies and calls `public.set_updated_at_timestamp()` for `updated_at` triggers. That helper has not yet been re-confirmed during the present inspection window, so Phase 1 remains blocked even though `audiobook_projects` was confirmed absent during the last successful read.

The order `02151330 -> 02151736 -> 02151848` must be preserved. The third migration replaces the owner-consistency function with the corrected form and is not a substitute for installing the earlier schema/hardening objects.

## 6. License Wallet dependency notes

The foundation is additive in intent but uses ordinary `CREATE TABLE`, `CREATE POLICY`, and `CREATE TRIGGER` statements rather than universally idempotent `IF NOT EXISTS` forms. It therefore must not be run until table/policy/trigger collisions are proven absent.

The original Wallet cron migration is deliberately excluded from the executable sequence. A replacement must target the independent deployment and use an independently managed scheduler secret. The old Lovable URL/credential must not be copied into the new migration.

## 7. Rights Passport dependency notes

The Rights chain creates multiple PostgreSQL enum types and many named tables/policies/triggers. Type-name collision is especially important because `CREATE TYPE` is not idempotent. Earlier inspection verified `has_role` and `touch_updated_at`, but the full `rights_%` type/table/policy inventory still needs to be rerun before order 7.

The final RLS hardening migration references the complete Rights table set and therefore belongs last in the Rights chain.

## 8. Product SEO Phase 2 dependency notes

The Product SEO migration is designed as an additive column migration using `ADD COLUMN IF NOT EXISTS`, but it also adds named check constraints conditionally. Before applying it, staging must confirm whether any SEO columns or same-named constraints already exist and whether their definitions match the recovered migration. A same-name/different-definition state must be treated as drift, not silently accepted.

## 9. Read-only queries required to clear the gate

The following must succeed against `ypelutaddlibqvpaekyq` before any migration write:

```sql
-- helper functions
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where (n.nspname='public' and p.proname in ('set_updated_at_timestamp','touch_updated_at','has_role'))
   or (n.nspname='storage' and p.proname='foldername')
order by 1,2;

-- target tables
select table_schema, table_name
from information_schema.tables
where table_schema='public'
  and (table_name like 'audiobook_%'
       or table_name like 'license_wallet_%'
       or table_name like 'rights_%')
order by table_name;

-- target enums/types
select n.nspname, t.typname, e.enumlabel, e.enumsortorder
from pg_type t
join pg_namespace n on n.oid=t.typnamespace
left join pg_enum e on e.enumtypid=t.oid
where n.nspname='public'
  and (t.typname like 'audiobook_%' or t.typname like 'rights_%')
order by t.typname,e.enumsortorder;

-- required buckets
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets
where id in ('audiobook-manuscripts','audiobook-audio','license-wallet-documents','product-covers')
order by id;

-- collisions in policies
select schemaname,tablename,policyname,cmd,roles
from pg_policies
where (schemaname='public' and
       (tablename like 'audiobook_%' or tablename like 'license_wallet_%' or tablename like 'rights_%'))
   or (schemaname='storage' and tablename='objects' and
       (policyname ilike '%audiobook%' or policyname ilike '%wallet%'))
order by schemaname,tablename,policyname;

-- collisions in triggers
select event_object_schema,event_object_table,trigger_name,event_manipulation
from information_schema.triggers
where event_object_schema='public'
  and (event_object_table like 'audiobook_%'
       or event_object_table like 'license_wallet_%'
       or event_object_table like 'rights_%')
order by event_object_table,trigger_name,event_manipulation;

-- scheduler/network extensions
select extname,extversion
from pg_extension
where extname in ('pg_cron','pg_net','http','uuid-ossp','pgcrypto')
order by extname;

-- migration ledger
select * from supabase_migrations.schema_migrations order by version desc limit 60;

-- SEO drift
select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='marketplace_products'
  and column_name like 'seo_%'
order by ordinal_position;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid='public.marketplace_products'::regclass
  and conname like 'marketplace_products_seo_%'
order by conname;
```

## 10. Proposed execution order after the gate clears

The first write sequence is intentionally staged and reversible by checkpoint rather than one giant replay:

1. staging prerequisite/bootstrap migration for missing private storage buckets and any missing compatible helper required by the recovered schema;
2. Audiobook foundation + two hardening migrations;
3. License Wallet foundation + reminder offsets + billing migration, **skipping the quarantined Lovable cron migration**;
4. Rights Passport migrations in timestamp order;
5. Product SEO Phase 2 additive migration;
6. regenerate Supabase TypeScript types from the resulting certified staging schema;
7. regenerate TanStack route tree from the recovered route source;
8. run schema/RLS/storage/typecheck/unit/integration launch gates;
9. only then consider a replacement Wallet scheduler against the independent host.

## 11. Decision

**STAGING MIGRATION APPLY: NO-GO**

Blocking reasons:

- follow-up read-only staging inspection is currently unavailable because the Supabase connector is returning HTTP 502;
- required bucket/helper/policy/trigger/type/migration-ledger checks are therefore incomplete;
- the Lovable Wallet cron migration is intentionally quarantined and requires an independent replacement;
- source parity still has documented generated/binary exceptions in `SOURCE_RECOVERY_RECONCILIATION.md`.

No migration will be applied until these blockers are closed with executed evidence.