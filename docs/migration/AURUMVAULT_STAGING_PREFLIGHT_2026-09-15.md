# AurumVault independent staging preflight — 2026-09-15

## Scope

Read-only inspection of independent Supabase staging project `ypelutaddlibqvpaekyq` before any recovered migration is applied.

Production is outside this preflight. No production database, DNS, live Stripe webhook, or production branch changes are authorized by this document.

## Project state

- Project: `aurumvault-staging`
- Ref: `ypelutaddlibqvpaekyq`
- Region: `us-east-1`
- PostgreSQL: 17.6.1.166
- Health at inspection: `ACTIVE_HEALTHY`
- Application data sampled at inspection:
  - `auth.users`: 0
  - `marketplace_products`: 0
  - `rights_passports`: 0
  - `creator_studio_projects`: 0

The staging project is therefore isolated and data-empty for the sampled application domains.

## Existing application schema

The public schema currently contains 32 tables. Digital Rights Passport and Creator Studio objects are already present.

Audiobook Studio tables are not present.

License Wallet tables are not present.

## Required database primitives checked

Present:

- `public.has_role(_user_id uuid, _role app_role) -> boolean`
- `public.touch_updated_at() -> trigger`
- `public.app_role` values include `admin`, `seller`, and `buyer`
- `public.marketplace_products.id` is UUID
- `public.marketplace_products.seller_id` is UUID
- `storage.foldername(name text)` exists

Missing:

- `public.set_updated_at_timestamp()`

### Consequence

The exact recovered Audiobook Studio foundation migration `20260902151330_c00d942f-4e86-4650-baab-34781a4fcae1.sql` calls `public.set_updated_at_timestamp()` while creating updated-at triggers. On the current independent staging database, replaying that exact migration would fail because the referenced trigger function is absent.

Do **not** modify the recovered source migration to hide this divergence. Preserve the exact Lovable source, then add a separately reviewed compatibility/prerequisite migration only after source recovery is complete.

## Storage preflight

Existing buckets:

- `digital-rights-evidence` — private
- `product-covers` — public
- `product-files` — private
- `starter-pack-bundles` — private
- `starter-pack-covers` — public

Missing buckets required by recovered functionality:

- `audiobook-manuscripts`
- `audiobook-audio`
- `license-wallet-documents`

The exact Audiobook Studio foundation migration creates owner-scoped policies for its bucket names but does not create the bucket records themselves. The License Wallet foundation similarly defines storage policies while staging currently has no `license-wallet-documents` bucket.

The corresponding recovered storage policy names are also not currently present in staging, so there is no policy-name collision at this point.

## Migration-history preflight

The inspected migration-history table does not currently record the recovered Audiobook Studio, License Wallet, or September 7 Rights Passport recovery migration versions checked during this preflight.

The Audiobook owner-consistency follow-up `20260902151848_986fc369-9419-4efa-9eea-eeec20c39da9.sql` was re-read from exact Lovable revision `c78b3ca13b27e0563a6bb01c270bef10407b82db` and verified against the recovery branch copy.

## License Wallet cron quarantine

Original Lovable migration `20260902213142_f8dffe65-c985-4f29-ba77-80405c3dd48b.sql` schedules a Lovable-hosted reminder endpoint and embeds a legacy credential in the scheduled request.

It is intentionally excluded from the executable recovery chain. See `docs/migration/quarantine/20260902213142_license_wallet_lovable_cron.md`.

The credential is not to be copied into Git history. Independent reminder scheduling must be rebuilt against an independently hosted endpoint and independently managed secret boundary.

## Security advisor snapshot

The staging security advisor returned only informational security-definer-view notices for the existing views:

- `public.creator_studio_projects_with_keys`
- `public.rights_all_passports`

No recovered migration has been applied as part of this inspection.

## Current apply gate

**NO APPLY YET.**

Before the first staging migration run, the recovery branch must have:

1. exact-source recovery completed for the target Lovable revision;
2. an explicit compatibility migration for the missing `set_updated_at_timestamp()` prerequisite, without rewriting the recovered source migration;
3. an explicit private-bucket creation migration/step for `audiobook-manuscripts`, `audiobook-audio`, and `license-wallet-documents`;
4. the Lovable-dependent License Wallet cron migration kept quarantined;
5. a dry-run/order review of the recovered migration chain;
6. a rollback/reset plan for the isolated staging project.

Until those gates are satisfied, staging remains inspection-only.