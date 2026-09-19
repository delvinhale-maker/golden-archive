# AurumVault Staging Schema Certification — 2026-09-18

Target: `aurumvault-staging` / `ypelutaddlibqvpaekyq`

Production comparison source: Lovable project `622409bb-9a09-4d0a-94c0-f5a8640d5c80`, production Supabase ref `rymruqkxmbxobrkkekoc`.

## Decision

**Schema certification: GREEN WITH DOCUMENTED INTENTIONAL DELTAS.**

This decision is limited to schema/runtime-database behavior. It does not certify production data, Auth identity migration, Storage object migration, external staging deployment, or production promotion.

No production write was performed during this certification.

## Production-table coverage

- Production public tables: **114**
- Staging contains: **114 / 114 production table names**
- Staging additionally contains independent Canva / Creator Studio tables that do not exist in the Lovable production database.
- Previously certified indexes: **248 / 248** on the production table set with matching definition fingerprint.
- Previously certified enums: **8 types / 43 labels** with matching fingerprint.

## Constraints

- Production: **388**
- Staging production-table set: **388**
- Same-named constraint definitions changed: **0**
- Naming-only delta:
  - production: `cover_audit_alert_config.singleton_row`
  - staging: `cover_audit_alert_config.cover_audit_alert_config_singleton_row`

The constraint body is equivalent. This is a naming-only reconstruction delta.

## Triggers

- Production: **124**
- Staging production-table set: **124**
- Same-named trigger definitions changed: **0**

Intentional set deltas:

- Production-only duplicate guard trigger:
  `affiliate_commissions.affiliate_commissions_guard_creator_update`
- Staging-only independent integration version trigger:
  `integration_connections.trg_integration_connections_refresh_version`

The affiliate-commission row remains protected by the active guard in staging. The integration refresh trigger supports the independent Canva/TikTok token-refresh architecture.

## RLS policies

After the staging-only migration
`20260919014500_aurumvault_schema_security_parity.sql`:

- Production: **303** policies
- Staging production-table set: **301** policies
- Staging-only unmatched policies: **0**
- Production-only unmatched policies: **2**

Intentional omissions:

1. `integration_connections_owner_delete`
   - Not copied into staging.
   - Independent Canva/TikTok disconnect flows update the row to `revoked` and wipe encrypted token material through the server/service-role path.
   - Direct client row deletion is unnecessary and is intentionally withheld.

2. `user_roles_self_read`
   - Redundant with the existing `Users can read their own roles` policy.
   - Staging intentionally carries one self-read policy instead of two equivalent production policies.

The following weaker staging policies were found and corrected before certification:

- Affiliate referral click INSERT now requires an **active** affiliate and validates product ownership against the referral creator.
- Creator follower rows are no longer publicly readable; authenticated users can read only rows in which they are the follower or creator. Public follower counts use the dedicated count RPC.
- Product Q&A asker UPDATE is now limited to unanswered questions and cannot write answer metadata.
- Seller self-application INSERT now requires `status = pending`.
- Public product-variant discovery is scoped to `anon`, matching the recovered production contract.

Remaining raw policy-definition differences are intentional/equivalent hardening, primarily:

- `(SELECT auth.uid())` init-plan form instead of repeated `auth.uid()`
- explicit `anon, authenticated` or `authenticated` role scoping instead of `public`
- service-role-only policies expressed as `TO service_role USING (true)` instead of `TO public USING (auth.role() = 'service_role')`

These staging forms are equivalent or narrower, not broader.

## Grants

Staging intentionally does **not** reproduce Lovable production's broad table grants to `anon` and `authenticated` when RLS/service RPCs are sufficient.

This is a deliberate least-privilege delta.

The internal hardening migration
`20260919015200_aurumvault_internal_object_hardening.sql` additionally:

- revoked public/anon/authenticated EXECUTE on the trigger-only `handle_new_user()`
- revoked anon/authenticated table privileges on `license_wallet_billing_events`
- retained service-role access for those internal paths

## Functions and procedures

Raw function fingerprints differ because production includes the pgvector extension's public helper functions while staging does not have pgvector installed.

No production or staging public table currently has a `vector`, `halfvec`, or `sparsevec` column. The vector extension is therefore intentionally omitted from staging until a real application feature requires it.

Lovable-production-only functions intentionally **not** copied:

- `email_queue_dispatch()`
- `email_queue_wake()`

Those functions point back to Lovable email/runtime infrastructure and remain quarantined.

Staging-only functions are associated with independent Creator Studio, Canva/integration refresh behavior, and related staging functionality.

After normalizing comments, whitespace, schema qualification and equivalent casts, same-named application functions are behaviorally equivalent except for documented intentional corrections:

1. `get_creator_referral_stats()`
   - Production refers to nonexistent `order_items.unit_price_cents` / `quantity`.
   - Staging uses the actual `unit_amount_cents` schema and is the corrected implementation.

2. `confirm_subscriber(text)`
   - Production can report an arbitrary invalid token as already confirmed whenever any confirmed subscriber exists.
   - Staging fails closed with `invalid_or_expired` when the supplied token does not match a pending subscriber.

Several staging functions also use the hardened `search_path = pg_catalog, public` form instead of production's `public`-first path.

## Extensions

Production installed extensions relevant to the application include:

- pg_cron
- pg_net
- pg_stat_statements
- pgcrypto
- pgmq
- plpgsql
- supabase_vault
- uuid-ossp
- vector

Staging has the same required non-vector runtime extensions. `pg_net` is a newer compatible patch version in staging. Vector is available but intentionally not installed because no application table uses a vector type.

## Lovable runtime database dependency check

Read-only staging inspection found:

- **0** public function/procedure definitions containing `lovable`
- **0** public views containing `lovable`
- **0** active cron jobs whose command references a Lovable hostname, the old project preview hostname, or the Lovable connector gateway

A historical source migration still records an old Lovable-hosted cron URL. That historical file is retained for migration provenance; it is **not active in the staging runtime**.

The original Lovable-bound License Wallet cron migration remains quarantined and is not an executable staging migration.

## Supabase advisor rerun

Security advisor after the final staging hardening:

- `rls_enabled_no_policy`: **7 INFO**
  - the listed tables are intentionally internal/service-role surfaces; client policies are not required
  - `license_wallet_billing_events` client grants were explicitly revoked
  - `product_slug_redirects` remains service-role resolved
- anonymous SECURITY DEFINER executability: **6 WARN**
  - remaining functions are intentionally public RPC surfaces such as subscription confirmation, follower count, public Q&A and anonymous cart flows; each requires its own input/ownership guard
- authenticated SECURITY DEFINER executability: **13 WARN**
  - includes intentional authenticated RPCs; admin RPCs perform role checks in the function body
- leaked-password protection: **1 WARN**
  - staging Auth configuration still needs leaked-password protection enabled before production certification

Performance advisor:

- unindexed foreign keys: **67 INFO**
- auth RLS init-plan findings: **187 WARN**
- unused indexes: **141 INFO**
- multiple permissive policies: **47 WARN**
- Auth DB connection absolute setting: **1 INFO**

These performance findings are recorded for deliberate tuning. They were not mass-applied during source/schema parity recovery because doing so would change behavior and indexing beyond the migration objective.

## Schema gate

**GREEN WITH INTENTIONAL DELTAS.**

The next gates are:

1. exact-SHA code/CI certification
2. independent staging environment configuration
3. external staging deployment
4. Auth, marketplace, payments and advanced-product certification
5. production data/Auth/Storage rehearsal

Production remains NO-GO until those later gates are green.
