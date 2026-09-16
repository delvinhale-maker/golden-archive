# AurumVault Lovable Exit — Parity & Export Evidence

Date: 2026-09-16
Recovery branch: `migration/aurumvault-lovable-exit`
Frozen Lovable revision: `c78b3ca13b27e0563a6bb01c270bef10407b82db`
Production Lovable project: `622409bb-9a09-4d0a-94c0-f5a8640d5c80`
Production backend reference: `rymruqkxmbxobrkkekoc`
Independent staging: `ypelutaddlibqvpaekyq`

## Boundary

All production evidence in this report came from read-only queries. No production database rows, auth records, storage objects, Stripe configuration, DNS, customer accounts, or live OAuth connections were modified.

All database writes described here were applied only to the independent staging project.

`delvinhale-maker/golden-archive` remains the recovery workspace. This report does not declare it the permanent canonical AurumVault Store repository, and nothing from this work was merged to `main`.

## 1. Reconciliation SQL persisted to Git

The staging reconciliation work is now represented on the migration branch by these migrations:

1. `20260916142532_aurumvault_email_infra_reconcile.sql`
2. `20260916142628_aurumvault_storage_bucket_shape_reconcile.sql`
3. `20260916143041_aurumvault_academy_schema_reconcile.sql`
4. `20260916143222_aurumvault_qr_schema_reconcile.sql`
5. `20260916143541_aurumvault_creator_ops_schema_reconcile.sql`
6. `20260916143653_aurumvault_marketplace_support_schema_reconcile.sql`
7. `20260916143947_aurumvault_frozen_column_parity_reconcile.sql`
8. `20260916144032_aurumvault_product_category_enum_parity.sql`
9. `20260916144359_aurumvault_frozen_function_parity_reconcile.sql`
10. `20260916162211_aurumvault_release_date_type_parity.sql`

The tenth migration closes the final common-schema type mismatch found during semantic column comparison: frozen production uses `timestamptz` for `marketplace_products.release_date`; staging had reconstructed it as `date`. Staging contained zero `marketplace_products` rows when the type was corrected.

## 2. Table and column parity evidence

Frozen production contains 114 public base tables.

Independent staging contains those frozen-production table names plus newer staging-only systems such as Creator Studio and Canva support. Therefore raw staging table totals are intentionally higher and are not used as a parity claim.

For the frozen/common schema, the comparison excluded:

- staging-only `creator_studio_%` tables;
- staging-only `canva_%` tables;
- the intentional staging hardening column `integration_connections.refresh_version`.

After the `release_date` correction:

- frozen production common columns: **1,231**;
- filtered staging common columns: **1,231**;
- semantic column signature — production: `2642b60fc1807637bee46665cf1e2cd6`;
- semantic column signature — staging: `2642b60fc1807637bee46665cf1e2cd6`.

The semantic signature is built from table name, column name, data type, underlying UDT, and nullability, ordered by table/column name. This demonstrates semantic frozen/common column parity.

This is **not** a claim of byte-identical DDL or physical column ordinal identity. Some reconstructed tables have different physical column order, which is not used as a functional parity signal.

## 3. Enum/type parity evidence

Executed production evidence:

- public enum types: **34**;
- enum labels: **227**;
- ordered type/label hash: `fdf520144eb6dbbb7660b0b5fe3469d9`.

Executed staging evidence:

- public enum types: **34**;
- enum labels: **227**;
- ordered type/label hash: `fdf520144eb6dbbb7660b0b5fe3469d9`.

**ENUM PARITY: MATCHED** for public enum type names, labels, and enum sort order.

## 4. Index parity evidence

Executed production evidence:

- public indexes: **298**;
- ordered `tablename.indexname` hash: `7cd92f6c79e17072c13cfdf96a13d89b`.

Staging contains **334** public indexes in total. Exactly **36** are on staging-only Creator Studio/Canva tables. After excluding those newer tables:

- filtered staging indexes: **298**;
- ordered `tablename.indexname` hash: `7cd92f6c79e17072c13cfdf96a13d89b`.

**FROZEN/COMMON INDEX-NAME SET PARITY: MATCHED.**

This comparison proves the expected frozen/common index-name set, not byte-identical index DDL expressions in every case.

## 5. Function parity evidence

Frozen production exposes 70 non-C public function signatures. Four are `vector` extension aggregate signatures, leaving **66 application-owned signatures** relevant to the application comparison.

A direct production-signature-to-staging membership comparison found exactly three production application signatures absent from staging:

- `email_queue_dispatch()`;
- `email_queue_wake()`;
- `get_creator_referral_stats()`.

The first two are deliberately quarantined because their frozen production definitions hard-code a Lovable-hosted email queue endpoint and Lovable-managed credential flow. Recreating them would reintroduce the runtime dependency this migration is intended to remove.

`get_creator_referral_stats()` is also deliberately quarantined because the frozen production definition references `order_items.unit_price_cents` and `order_items.quantity`, while the frozen production `order_items` table contains neither column. Blindly restoring it would reproduce a stale/broken production function rather than a valid independent implementation.

Result:

- production application signatures: **66**;
- present in staging: **63**;
- intentional quarantines: **3**;
- unexplained missing function signatures: **0**.

Staging also intentionally hardens some function `search_path` and execute grants, so this is not a byte-identical function-body parity claim.

## 6. Trigger parity evidence

Frozen production has **124** non-internal public triggers.

A direct `table.trigger_name -> function_name` comparison found one production key not present in staging:

`affiliate_commissions.affiliate_commissions_guard_creator_update -> affiliate_commissions_guard_creator_update`

Frozen production also has a second trigger on the same table invoking the same guard function:

`affiliate_commissions.trg_affiliate_commissions_guard_update -> affiliate_commissions_guard_creator_update`

Staging retains the second guard trigger and intentionally does not recreate the duplicate first trigger, avoiding duplicate execution of the same guard during one update.

**UNEXPLAINED FROZEN TRIGGER GAPS: 0.**

The raw staging trigger count is higher because staging contains newer systems not present in the frozen production schema.

## 7. Supabase generated TypeScript types evidence

The current staging database successfully generated a new Supabase TypeScript definition after the final `release_date` parity correction. The generated output includes:

- Academy;
- Audiobook Studio;
- Digital Rights Passport;
- License Wallet;
- current marketplace/Product SEO fields;
- Creator Studio;
- Canva support;
- current staging RPCs;
- all 34 public enum types, including all 20 `product_category` values.

However, the checked-in branch file `src/integrations/supabase/types.ts` remains stale. Inspection of the checked-in artifact found it does not yet include key current schema surfaces such as Audiobook, License Wallet, Creator Studio, and the recovered Product SEO typing.

Because the generated output is large, this run does not replace the branch file with a partial or potentially truncated artifact.

**DATABASE TYPES GENERATION: PASS**

**CHECKED-IN GENERATED TYPES ARTIFACT: NO-GO / STALE**

The branch type file must be replaced deterministically with the complete generated staging output before the source-artifact gate can close.

## 8. Exact production data inventory

A read-only exact `count(*)` inventory was executed across every production public base table.

Results:

- public base tables: **114**;
- non-empty tables: **45**;
- empty tables: **69**;
- total public rows: **6,232**.

The exact per-table baseline is committed separately in:

`docs/migration/PRODUCTION_ROW_COUNTS_2026-09-16.md`

These exact counts supersede earlier planner/reltuples estimates.

No production rows have been copied to staging.

## 9. Exact production storage inventory

Read-only storage inventory:

- objects: **341**;
- total bytes: **961,531,760**.

Key buckets:

| Bucket | Objects | Bytes |
|---|---:|---:|
| product-files | 136 | 478,145,256 |
| product-covers | 100 | 310,772,203 |
| academy-covers | 66 | 147,076,014 |
| vault-finds | 22 | 13,058,986 |
| kingdom-picks | 13 | 11,693,590 |
| product-previews | 3 | 737,935 |
| creator-resources | 1 | 47,776 |

The remaining known buckets currently contain zero objects.

No storage object bytes have been copied to staging.

## 10. Production auth inventory

Read-only aggregate auth evidence:

- auth users: **4**;
- email-confirmed users: **4**;
- users with sign-in history: **4**;
- users with password hashes: **3**;
- users without password hashes: **1**;
- email identities: **3**;
- Google identities: **1**.

No email address, password hash, refresh token, access token, or credential was exposed in the migration documentation or chat.

This does not prove password/session/OAuth portability. Those remain restore-and-certification gates.

## 11. Integration inventory

Production contains 4 integration connection rows:

- Canva — 3 / `pending`;
- TikTok Shop — 1 / `pending`.

Encrypted token blobs may depend on Lovable-managed encryption material and cannot be assumed portable merely because the rows can be queried.

## 12. Export path evidence

The now-working production SQL path is reliable enough for read-only inventory and validation. It is not a secure complete backup mechanism.

The currently available Lovable connector does not expose a backup/download/export function or a storage-object binary copy function. Therefore the preferred next export mechanism remains a provider-native PostgreSQL/Supabase backup or logical dump plus a provider-native/authenticated storage export.

The detailed export and restore sequence is committed in:

`docs/migration/PRODUCTION_EXPORT_PLAN_2026-09-16.md`

If a usable backup/export in Lovable requires temporary plan reactivation, credits, or payment, that decision must be presented to Delvin before any purchase or reactivation. No payment/reactivation is authorized by this report.

## 13. Current gate

### Completed in this phase

- staging reconciliation SQL persisted to Git;
- all frozen production table names represented in staging;
- frozen/common semantic columns matched by executed signature evidence;
- public enums matched exactly by executed hash/count evidence;
- frozen/common index-name set matched exactly by executed hash/count evidence;
- function gaps reduced to three documented intentional quarantines;
- trigger gap reduced to one documented duplicate production trigger intentionally not recreated;
- current staging TypeScript types successfully generated;
- exact production public row counts captured;
- exact production storage aggregate captured;
- auth and integration aggregate inventories captured;
- production export plan documented.

### Still open

- checked-in `src/integrations/supabase/types.ts` is stale and must be deterministically regenerated/replaced;
- secure full database/auth backup/export has not yet been obtained;
- production storage object manifest/bytes have not been exported;
- production rows/auth identities/storage objects have not been restored to staging;
- Lovable runtime dependencies have not yet been removed;
- independent external staging deployment has not yet started or been certified.

## Decision

**PRODUCTION CUTOVER: NO-GO**

**PRODUCTION DATA/AUTH/STORAGE MIGRATION: NO-GO**

**LOVABLE DEPENDENCY-REMOVAL / EXTERNAL STAGING PHASE: HOLD until the checked-in generated-types artifact and secure export path are closed.**

Production remains untouched.