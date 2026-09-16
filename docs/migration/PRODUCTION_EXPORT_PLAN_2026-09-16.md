# AurumVault Lovable Exit — Production Export Plan

Date: 2026-09-16
Production Lovable project: `622409bb-9a09-4d0a-94c0-f5a8640d5c80`
Production backend reference: `rymruqkxmbxobrkkekoc`
Independent staging target: `ypelutaddlibqvpaekyq`
Frozen source anchor: `c78b3ca13b27e0563a6bb01c270bef10407b82db`

## Non-negotiable boundary

This plan is read-only with respect to Lovable production until a secure export exists and an explicit migration window is approved. Do not mutate production database rows, auth records, storage objects, Stripe configuration, DNS, OAuth configuration, or live customer accounts during export preparation.

All restore, reconciliation, and certification work must occur in the independent staging project first.

## Current production inventory baseline

The read-only production inventory established:

- `114` public base tables;
- `6,232` exact public rows across those tables;
- `341` storage objects;
- `961,531,760` total storage bytes;
- `4` auth users;
- `3` email identities and `1` Google identity;
- `3` users with password hashes and `1` user without a password hash;
- `4` integration connection rows: `3` Canva / pending and `1` TikTok Shop / pending.

No production data, auth identities, or storage objects have been copied yet.

## 1. Database and application-data export

### Preferred path

Obtain a real logical PostgreSQL backup/export or Supabase backup that can securely preserve the production database without emitting sensitive rows into chat. The export must cover at minimum:

- `public` application data;
- `auth` records required for user identity continuity;
- relevant storage metadata;
- UUID primary keys and foreign keys;
- Stripe object identifiers already stored in the database;
- order/download identifiers and download-token state;
- referral and affiliate codes;
- slugs and redirect records;
- timestamps and audit/event history.

A backup/dump is preferred over reconstructing the production database row by row through the conversational SQL interface.

### Current connector limitation

The currently available Lovable project connector exposes SQL querying but no backup, dump, export-download, or storage-object download operation. `query_database` is sufficient for read-only inventories and validation queries, but it is not a secure substitute for a complete logical backup.

If the Lovable dashboard exposes a backup/export only after temporarily restoring credits, reactivating a plan, or making a payment, stop and present that requirement to Delvin before any payment or reactivation decision. Do not purchase credits or reactivate services automatically.

### Restore destination

Restore production data only into `aurumvault-staging` first. Do not create or populate an independent production backend until staging restore and application certification have passed.

### Post-restore database checks

After the staging restore:

1. rerun exact row counts for all 114 frozen-production public tables and reconcile every difference against `PRODUCTION_ROW_COUNTS_2026-09-16.md`;
2. run foreign-key/orphan checks across orders, order items, downloads, products, sellers, referrals, affiliates, Academy relationships, and other referenced entities;
3. verify preservation of UUIDs and critical external identifiers;
4. verify representative records through the application, not only SQL;
5. verify RLS/policy behavior using anonymous, authenticated-buyer, creator/seller, and admin boundaries;
6. confirm staging-only schema additions remain isolated and do not corrupt restored frozen-production rows.

A matching row count is necessary evidence, not sufficient evidence by itself.

## 2. Auth export and migration

### Required secure records

The auth migration must securely preserve the production identity graph, including the applicable records from:

- `auth.users`;
- `auth.identities`;
- provider linkage metadata required by Supabase Auth;
- user UUIDs referenced by public tables.

Do not print emails, password hashes, refresh tokens, provider tokens, or credentials into chat or Git.

### Password users

There are 3 production users with password hashes. Preserve the compatible password-hash fields through a secure database/auth export if Supabase supports direct restoration into the independent project. Do not convert these users to plaintext-password workflows and do not ask users for their current passwords as a migration technique.

### Google identity

There is 1 Google identity. Database identity rows alone are not enough: the independent Supabase project also needs its own Google OAuth provider configuration, redirect URIs, client credentials, and application settings.

### Sessions

Do not assume existing Lovable-production sessions will survive migration. JWT signing context, cookie scope, project URL, refresh-token state, and provider configuration can change between projects. Certification must explicitly test:

- email/password sign-in for the password-backed identities;
- password reset;
- Google OAuth sign-in for the Google-linked identity;
- sign-out;
- session refresh;
- protected-route behavior;
- preservation of the same user UUID mappings after restoration.

If session continuity is not technically portable, plan a controlled reauthentication event rather than representing old sessions as migrated.

## 3. Storage export and copy

### Exact production baseline

| Bucket | Public | Objects | Bytes |
|---|---:|---:|---:|
| academy-covers | yes | 66 | 147,076,014 |
| audiobook-audio | no | 0 | 0 |
| audiobook-manuscripts | no | 0 | 0 |
| avatars | yes | 0 | 0 |
| creator-covers | yes | 0 | 0 |
| creator-resources | yes | 1 | 47,776 |
| digital-rights-evidence | no | 0 | 0 |
| kingdom-picks | yes | 13 | 11,693,590 |
| license-wallet-documents | no | 0 | 0 |
| product-covers | yes | 100 | 310,772,203 |
| product-files | no | 136 | 478,145,256 |
| product-previews | yes | 3 | 737,935 |
| review-photos | no | 0 | 0 |
| tax-forms | no | 0 | 0 |
| vault-finds | yes | 22 | 13,058,986 |
| **Total** | — | **341** | **961,531,760** |

### Required object manifest

Before copying bytes, produce a manifest containing, where available:

- bucket ID;
- object path/name;
- object ID/version metadata;
- content type;
- byte size;
- created/updated timestamps;
- checksum or content hash where available.

Do not use public URL scraping as the migration mechanism. Prefer a provider-native export, authenticated service-role copy, backup restore, or another server-to-server path that can preserve private objects and exact paths.

### Copy order

The largest and most critical buckets are:

1. `product-files` — 136 objects / 478,145,256 bytes;
2. `product-covers` — 100 objects / 310,772,203 bytes;
3. `academy-covers` — 66 objects / 147,076,014 bytes;
4. `kingdom-picks` — 13 objects / 11,693,590 bytes;
5. `vault-finds` — 22 objects / 13,058,986 bytes;
6. `product-previews` — 3 objects / 737,935 bytes;
7. `creator-resources` — 1 object / 47,776 bytes.

Copy into matching staging bucket paths. Preserve public/private bucket behavior and configured file-size limits.

### Post-copy verification

For every bucket:

- compare object count;
- compare total bytes;
- compare path manifest;
- compare checksum/hash where available;
- test representative public object URLs;
- test representative private signed URLs;
- test actual product purchase/download-delivery code paths against staged order/download records.

No production storage object should be deleted, renamed, or overwritten during migration preparation.

## 4. Canva and TikTok Shop connections

Production currently contains 4 integration connection rows:

- Canva: 3 / `pending`;
- TikTok Shop: 1 / `pending`.

The encrypted token fields may depend on Lovable-managed encryption keys or ciphertext formats. Do not assume opaque encrypted blobs are portable merely because the rows can be copied.

If the independent environment cannot decrypt and validate the existing ciphertext, preserve safe metadata where useful and require a fresh OAuth authorization in staging. Reauthorization is preferable to copying unusable ciphertext and claiming integration parity.

## 5. Export acceptance gate

The export track is not complete until all of the following evidence exists:

- a secure production database/auth backup or equivalent provider-supported export;
- a complete storage object manifest and byte-copy path;
- staging restore completed without production mutation;
- exact row-count reconciliation against the September 16 baseline;
- foreign-key/orphan and critical-identifier checks passed;
- auth identities and login/reset/OAuth flows passed;
- storage object counts/bytes/paths and representative download flows passed;
- integration reauthorization or token-portability behavior explicitly verified.

Only after this export/restore gate and the independent application staging gate pass should production database migration, external production deployment, or DNS cutover be considered.

## Current decision

**PRODUCTION DATA/AUTH/STORAGE MIGRATION: NO-GO**

Reason: production inventory is now reliable and read-only access is working, but the connected Lovable interface does not expose a secure complete backup/export or storage-object copy mechanism. No live records or files have been migrated.