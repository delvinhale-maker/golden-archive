# Rights Passport — Migration Readiness Plan

**Status of this document: informational / pre-deployment planning only.**
None of the migrations below are applied. This file does not authorize
application of any migration — see `docs/rights-passport-launch-readiness.md`
and the master release report for the explicit operator sequence required
before any of these may be moved into `supabase/migrations/`.

## Backend safety context (see Phase 4 finding, full detail in the release report)

This repository's migration runner applies **any** SQL file placed under
`supabase/migrations/` **immediately** to a **single shared Supabase project**
that serves preview and production together (`supabase/config.toml` declares
one `project_id`; `.env`, `.env.production`, and `.env.development` all point
at the same `SUPABASE_PROJECT_ID`/`SUPABASE_URL`). This is not a theoretical
risk: `docs/proposed-migrations/20260828004015_create_integration_connections.sql`
carries a header confirming it was applied on 2026-08-28 to "the shared
Lovable Cloud database," including a follow-up grant-tightening statement
because the platform's default ACL over-granted table privileges on table
creation. **Classification: SHARED_BACKEND.** No Rights Passport migration
may be applied without a human explicitly confirming a safe path (see the
operator sequence in the release report) — none are applied by this document
or by this pass.

## Chronological dependency order

All four migrations must be applied **in this exact order** — each later
file's guard triggers/functions/foreign keys depend on tables or shared
helper functions created by an earlier one. None may be reordered or applied
in parallel with another still pending.

```
1. 20260829213658_create_rights_passport.sql
2. 20260830013807_rights_passport_control_workspace.sql
3. 20260830090000_rights_passport_documents_analysis.sql
4. 20260830150000_rights_passport_publishing.sql
```

All four are **additive only**. Confirmed by direct read of every statement
in every file: **zero occurrences of `DROP`, `TRUNCATE`, `DELETE`, or any
destructive `ALTER`** (no `ALTER ... DROP COLUMN`, no `ALTER ... TYPE` that
would rewrite existing data, no `ALTER` of any pre-existing table at all —
each file's own header states this and direct inspection confirms it). No
data-rewrite operation exists anywhere in this migration set. **No STOP
condition under Phase 3 is triggered.**

---

## 1. `20260829213658_create_rights_passport.sql`

**Purpose.** Foundation schema: the versioned passport workspace row and the
Rights Asset Registry™.

**Enums/types created:** `rights_passport_status`, `rights_verification_level`,
`rights_asset_type`, `rights_control_basis`, `rights_asset_status`,
`rights_ai_policy`.

**Tables created:** `rights_passports` (one row per version; `passport_key`
is the stable lineage identity, `id` is per-version), `rights_passport_assets`.

**Functions created:** `rights_passports_guard_identity()`,
`rights_passport_assets_guard_identity()`,
`rights_passport_assets_guard_passport_owner()`.

**Triggers:** `trg_rights_passports_updated` / `trg_rights_passport_assets_updated`
(reuse existing `touch_updated_at()`); `rights_passports_guard_identity_trg`
(blocks reassigning `owner_user_id`/`passport_key` post-creation);
`rights_passport_assets_guard_identity_trg` (same, for assets);
`rights_passport_assets_guard_passport_owner_trg` (blocks attaching an asset
to a `passport_key` the caller doesn't own — defense in depth beyond RLS).

**Indexes:** owner and passport_key btree indexes on both tables; a **partial
unique index** `rights_passports_one_active_per_key` on `(passport_key) WHERE
status = 'ACTIVE'` — a real DB-level constraint, not just app logic, that at
most one version per lineage can ever be ACTIVE at once.

**RLS policies:** owner-scoped SELECT and ALL (write) on both tables —
`owner_user_id = auth.uid() OR has_role(auth.uid(),'admin')`. **No anon
grant or policy anywhere in this file** (`REVOKE ALL ... FROM anon`
explicit on both tables). `authenticated` is also explicitly denied
`DELETE, TRUNCATE, REFERENCES, TRIGGER` — only `SELECT, INSERT, UPDATE`
are granted, so even a compromised/malicious authenticated session cannot
hard-delete a row through this grant surface.

**Storage changes:** none.

**Dependency on earlier migrations:** none — this is the root. References
only pre-existing `public.has_role(uuid, app_role)` and
`public.touch_updated_at()`.

**Lock/risk level:** LOW. Two `CREATE TABLE`s, six `CREATE TYPE`s, indexes,
policies, triggers — no data in these tables yet (new tables), so no
table-rewrite lock on existing data is possible.

**Additive:** yes, 100%.

**Rollback strategy:** drop the two tables and six types in reverse
dependency order (assets before passports, due to no FK from assets to
passports at the DB level — but application code depends on the
`passport_key` relationship, so a real rollback should confirm no dependent
Round 2-4 tables/functions have already been layered on top before dropping).
Since nothing is applied yet, rollback here means simply not merging the
file, or `DROP TABLE`/`DROP TYPE ... CASCADE` if it was applied and needs
reverting before any dependent migration (2-4) is applied.

**Production impact if applied to the shared backend today:** creates new,
empty tables and types invisible to every other feature (no existing route,
function, or table references `rights_passports`/`rights_passport_assets`).
Zero impact on existing production data or traffic. The risk is exclusively
in the *next* step (whether the surrounding product surfaces are actually
ready to be exposed to real users), not in this migration's mechanics.

---

## 2. `20260830013807_rights_passport_control_workspace.sql`

**Purpose.** Round 2: AI Consent Builder™, License Register™, Provenance &
Evidence Register™, Risk & Conflict Review™.

**Enums/types created:** `rights_ai_use_case`, `rights_permission`,
`rights_license_permission_type`, `rights_license_status`,
`rights_evidence_type`, `rights_evidence_status`, `rights_flag_severity`,
`rights_flag_status`.

**Tables created:** `rights_ai_consents`, `rights_licenses`,
`rights_evidence`, `rights_review_flags`.

**Functions created:** four `*_guard_identity()` functions (one per table);
`rights_workspace_guard_passport_owner()` — a **shared, generic** guard
reused by every table in this file and reused again by migrations 3 and 4;
`rights_workspace_guard_asset_passport()` — verifies an `asset_id` on a
consent/license/evidence row actually belongs to the same `passport_key`
as the row itself (defense in depth beyond the FK, which alone only proves
the asset exists somewhere, not that it's the caller's own asset in this
lineage).

**Triggers:** identity-guard and passport-owner-guard triggers on all four
new tables; asset-passport-guard triggers on the three tables that reference
an asset (`rights_ai_consents`, `rights_licenses`, `rights_evidence`).

**Indexes:** owner/passport_key btree indexes on all four tables; a partial
index on open/acknowledged review flags; **uniqueness constraints** used as
idempotency keys — `rights_ai_consents_unique_scope` (one permission per
passport/asset-or-passport-wide/use-case) and
`rights_review_flags_unique_rule` (one flag per passport/rule/entity, so the
deterministic rule engine can safely re-run and upsert without duplicating).

**RLS policies:** same owner-scoped pattern as migration 1, on all four
tables. No anon grant/policy anywhere.

**Storage changes:** none.

**Dependency on earlier migrations:** requires `rights_passports` and
`rights_passport_assets` (migration 1) to exist — FKs to
`rights_passport_assets(id)`, and `rights_workspace_guard_passport_owner()`
queries `rights_passports` directly.

**Lock/risk level:** LOW. Four new empty tables, no ALTER of anything
existing.

**Additive:** yes, 100%.

**Rollback strategy:** drop the four tables, their guard functions, and the
eight new types, in reverse dependency order relative to migration 1 (must
be rolled back before migration 1 if both were applied, since this file's
guard function depends on migration 1's table).

**Production impact:** zero on existing systems — same reasoning as
migration 1.

---

## 3. `20260830090000_rights_passport_documents_analysis.sql`

**Purpose.** Round 3: document upload, multi-pass AI extraction, the
evidence-grounded finding review queue.

**Enums/types created:** `rights_document_type`, `rights_document_status`,
`rights_parse_status`, `rights_analysis_status`, `rights_analysis_run_status`,
`rights_analysis_pass_type`, `rights_finding_review_status`.

**Tables created:** `rights_passport_documents`, `rights_analysis_runs`,
`rights_analysis_findings`.

**Functions created:** `rights_passport_documents_guard_identity()` (also
blocks `storage_path` from ever changing post-insert),
`rights_analysis_runs_guard_identity()`,
`rights_analysis_findings_guard_identity()` (also blocks `normalized_value`
— the AI's raw extracted value — from being edited in place; corrections
must go through the separate `edited_value` column, keeping the original AI
output auditable), `rights_workspace_guard_document_passport()`,
`rights_workspace_guard_run_passport()`.

**Triggers:** identity guards + passport-owner guards (reusing migration 2's
`rights_workspace_guard_passport_owner()`) on all three tables; a
document-passport guard on `rights_analysis_runs`; a run-passport guard
(verifying both `passport_key` AND `document_id` match the parent run) on
`rights_analysis_findings`.

**Indexes:** owner/passport_key/document/run btree indexes; a partial index
on `PENDING` findings; **uniqueness constraint**
`rights_analysis_findings_unique_key` on `(analysis_run_id, finding_key)` —
the idempotency key that makes retrying a failed AI pass upsert-safe rather
than duplicate-producing.

**RLS policies:** owner-scoped SELECT/ALL on all three tables, matching the
established pattern. No anon grant/policy on any of the three tables.

**Storage changes:** **this file also inserts a storage bucket**,
`digital-rights-evidence` (`public: false`, 50MB file-size limit, MIME
allowlist restricted to PDF/DOCX/TXT), plus four `storage.objects` RLS
policies (owner-scoped INSERT/UPDATE/DELETE/SELECT keyed off the first path
segment matching `auth.uid()`, mirroring the existing `product-files` bucket
convention). **The file's own header explicitly calls this out as requiring
separate authorization before being applied** — a private bucket with no
anon policy, so this is low-risk in isolation, but it is the one migration
in this set with a side effect (a bucket row + storage policies) beyond
plain table DDL.

**Dependency on earlier migrations:** requires `rights_passports` (1) and
reuses `rights_workspace_guard_passport_owner()` (2) directly, without
redefining it.

**Lock/risk level:** LOW for the table DDL. The storage bucket insert uses
`ON CONFLICT (id) DO NOTHING`, so it is idempotent and non-destructive even
if a bucket with that id somehow already existed.

**Additive:** yes, 100%, including the storage section.

**Rollback strategy:** drop the three tables/functions/types (reverse order
relative to 1-2); separately, remove the four storage policies and (only if
no objects were ever uploaded to it) the bucket row — bucket removal is the
one step here that needs a human check for existing objects first, since
`DROP` on a non-empty bucket has real content-loss risk, unlike everything
else in this migration set.

**Production impact:** zero on existing tables/routes. The storage bucket is
new and private with no anon access — no existing feature reads or writes
`digital-rights-evidence`.

---

## 4. `20260830150000_rights_passport_publishing.sql`

**Purpose.** Round 4: the immutable published-snapshot model, public
identity table, and the publish/verify/export pipeline's storage layer.

**Enums/types created:** `rights_snapshot_status`.

**Tables created:** `rights_passport_public_identities` (one stable
`public_id` per lineage, permanent), `rights_passport_snapshots` (one row
per publish event).

**Functions created:**
`rights_passport_public_identities_guard_immutable()` — unconditionally
rejects **every** UPDATE on this table for non-admins (a `public_id`, once
minted, can never change at all, not even in part);
`rights_passport_snapshots_guard_immutable()` — allows only `status`/
`revoked_at` to change and rejects any change to `owner_user_id`,
`passport_key`, `public_payload`, `content_hash`, `passport_version`,
`public_id`, `source_passport_id`, `schema_version`,
`supersedes_snapshot_id`, `published_at`, `effective_at`, and
`private_snapshot_metadata`.

> **Release-candidate fix applied during this audit (2026-08-30):** the
> guard function originally checked only 7 of the 11 fields that should be
> immutable — `schema_version`, `supersedes_snapshot_id`, `published_at`,
> and `effective_at` (plus `private_snapshot_metadata`) were left
> unguarded, meaning an owner's own RLS-granted `UPDATE` privilege on this
> table could have altered them directly, contradicting the file's own
> stated invariant ("only `status` and `revoked_at` may ever change"). Since
> this migration has never been applied, the fix was made directly in the
> proposed SQL rather than as a follow-up migration. No application code
> change was needed — `publishPassport`/`revokeSnapshot` never touched these
> fields to begin with; this closes an unenforced-at-the-DB-layer gap, not a
> behavioral regression.

**Triggers:** the two immutability guards above;
`rights_passport_public_identities_guard_passport_owner_trg` and
`rights_passport_snapshots_guard_passport_owner_trg`, both reusing
migration 2's `rights_workspace_guard_passport_owner()` unchanged.

**Indexes:** owner/passport_key/public_id btree indexes on
`rights_passport_snapshots`; a **partial unique index**
`rights_passport_snapshots_one_active_per_key` on `(passport_key) WHERE
status = 'ACTIVE'` — this is a genuine DB-level constraint (verified by
direct read of the SQL, not assumed) enforcing at most one ACTIVE snapshot
per lineage at the database layer, not merely in application code. A
`CHECK` constraint on `rights_passport_public_identities.public_id` enforces
the exact `^drp_[0-9a-f]{40}$` format at insert time; a `CHECK` on
`rights_passport_snapshots.content_hash` enforces `^[0-9a-f]{64}$` (a valid
SHA-256 hex digest shape) at insert time.

**RLS policies:** owner-scoped SELECT (+ INSERT-only, no UPDATE grant at
all) on `rights_passport_public_identities`; owner-scoped SELECT/ALL on
`rights_passport_snapshots`. No anon policy on either table — the public
`/rights/$publicId` route is designed to read via a service-role server
function, never via a direct anon-RLS path, matching this codebase's
existing convention for public-but-sensitive reads elsewhere.

**Storage changes:** none.

**Dependency on earlier migrations:** requires `rights_passports` (1, FK
`source_passport_id`) and reuses `rights_workspace_guard_passport_owner()`
(2) directly.

**Lock/risk level:** LOW. Two new empty tables, no ALTER of anything
existing.

**Additive:** yes, 100%.

**Rollback strategy:** drop `rights_passport_snapshots` before
`rights_passport_public_identities` (FK direction), then the guard
functions and the one new type. Must be rolled back before migrations 1-3
if all four were applied together and a full rollback is needed, since it
FKs into migration 1's table.

**Production impact:** zero on existing tables/routes — same reasoning as
migrations 1-2.

---

## Cross-cutting notes

- **No migration in this set contains `DROP`, `TRUNCATE`, `DELETE`, a
  destructive `ALTER`, or a data-rewriting operation of any kind.** Confirmed
  by direct text inspection of all four files, not by trusting file headers
  alone.
- Every table in every file enables RLS and has **zero** anon
  grants/policies. The only place `anon` could ever reach Rights Passport
  data is through a server function using the service-role client (e.g. the
  public Rights Card route) — and that path is scoped by application code
  (regex-validated `public_id`, `status IN ('ACTIVE','REVOKED')` only,
  never `SUPERSEDED`), not by RLS, which is why that specific code path
  is called out for extra scrutiny in the security section of the release
  report rather than assumed safe from the migration alone.
- Every guard-trigger function is `SECURITY DEFINER` with `search_path =
  public` pinned explicitly, and `EXECUTE` is revoked from `PUBLIC`, `anon`,
  and `authenticated` on every one of them — they can only ever run as
  trigger bodies, never be called directly by a client.
- The one migration with a real side effect beyond table DDL is #3 (storage
  bucket + storage policies) — flagged above for a manual "does this bucket
  already have objects" check if a rollback is ever needed after
  application, since bucket removal is the only step in this whole set that
  isn't trivially reversible.

## STOP-condition check (Phase 3 requirement)

Per the explicit instruction: *"If any destructive operation exists: STOP
and report."* — **No destructive operation exists in any of the four
migrations.** This check does not trigger a stop. The reason none of these
are applied is the **backend safety classification** (SHARED_BACKEND, see
Phase 4 in the release report), not any defect found in the SQL itself.
