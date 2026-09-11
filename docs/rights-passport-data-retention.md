# Rights Passport — Data Retention & Deletion Design

**Status: design document only. No destructive deletion is implemented by
this document or by this release-candidate pass.** Per the explicit
instruction this document exists to satisfy: *"Do not implement destructive
deletion without an approved retention policy."* Everything below is the
policy proposal an owner/legal stakeholder should approve before any
delete/purge code is written.

## Data categories and where they live today

| Category | Table / storage location | Mutable today? |
|---|---|---|
| Uploaded source files | `storage.objects` in the `digital-rights-evidence` bucket (private, owner-scoped) | Yes — no delete endpoint exists yet (Phase 2 audit finding, area 19: "Version/change handling" is MISSING as a distinct undo/delete feature) |
| Parsed document text | `rights_passport_documents.parsed_content` (JSONB) | Yes, via the document row |
| Analysis findings | `rights_analysis_findings` | Partially — `normalized_value` (the AI's raw output) is guarded immutable at the DB layer; `edited_value`/`review_status` are mutable |
| Structured rights records | `rights_passport_assets`, `rights_ai_consents`, `rights_licenses`, `rights_evidence` | Yes (owner-editable workspace data) |
| Evidence | `rights_evidence` rows + referenced storage objects | Yes |
| Immutable published snapshots | `rights_passport_snapshots` | **No** — guarded immutable at the DB layer except `status`/`revoked_at` (see the migration plan) |
| Public card | Derived live from the ACTIVE `rights_passport_snapshots` row via `getPublicRightsCard` | N/A — not separately stored |
| Generated exports (PDF/JSON) | Generated on demand, not persisted server-side | N/A — nothing to retain; each download is regenerated |
| Version history | Every non-current `rights_passports` row (SUPERSEDED/ARCHIVED) + every non-ACTIVE `rights_passport_snapshots` row | Workspace versions: yes. Published snapshots: no (immutable) |

## Proposed retention policy

1. **Uploaded source files & parsed text.** Proposed default: retained for
   the life of the passport lineage (no automatic expiry), since the
   evidence/provenance workflow depends on the owner being able to
   re-reference a source document indefinitely. A user-requested deletion
   of a single document (see below) should cascade to its parsed content
   and its analysis runs/findings (the migration already FKs
   `rights_analysis_runs`/`rights_analysis_findings` to
   `rights_passport_documents` with `ON DELETE CASCADE`), but should
   **not** cascade to any structured record (`rights_passport_assets`,
   `rights_ai_consents`, `rights_licenses`, `rights_evidence`) that a user
   already reviewed and accepted from that document — those records are
   independent workspace data once created, by design (the whole point of
   the Round 3.5 apply flow is that accepted data survives independent of
   its source).

2. **Analysis findings never accepted/applied.** Proposed default: no
   special retention beyond the parent document's lifecycle — a
   `PENDING`/`REJECTED`/`DEFERRED` finding is not independently valuable
   once its document is gone.

3. **Structured rights records (assets/consents/licenses/evidence).**
   Proposed default: retained indefinitely as the owner's editable record,
   until the owner explicitly deletes them (no delete UI/endpoint exists
   yet for any of these tables today — `archiveAsset` is the only
   soft-delete-shaped operation that exists, and even that is a status
   change, not a removal).

4. **Immutable published snapshots.** **Never deleted, only REVOKED.**
   This is a deliberate design choice, not an oversight: a published
   snapshot is the historical record of what a passport publicly declared
   at a point in time (spec §D: "Do not derive historical public versions
   dynamically... that would corrupt history"). Deleting a REVOKED or
   SUPERSEDED snapshot would let a passport's declared history be
   rewritten after the fact — exactly what the immutability guard trigger
   exists to prevent. If a genuine legal/privacy deletion request requires
   removing a specific published snapshot's content, that is a manual,
   audited, admin-only operation outside normal product flows, requiring
   explicit case-by-case authorization — not a self-service delete button.

5. **`public_id` after deletion.** A `public_id` (in
   `rights_passport_public_identities`) is permanent for the life of the
   passport_key lineage — the guard trigger blocks all updates to it,
   full stop. If an owner's account is deleted, `owner_user_id UUID ...
   REFERENCES auth.users(id) ON DELETE CASCADE` means every Rights
   Passport row for that user (including public identities and snapshots)
   is removed by the existing `ON DELETE CASCADE` FK behavior already in
   the proposed migrations — this is an existing, already-designed
   consequence of account deletion, not new behavior this document adds. A
   previously-printed QR code or bookmarked public URL for a deleted
   account's passport will resolve to "not found" (the same
   `{ found: false }` path `getPublicRightsCard` already returns for any
   unrecognized `public_id`) rather than erroring.

6. **Historical content hashes.** A `content_hash` is computed at publish
   time from that version's frozen `public_payload` and stored on the
   snapshot row. Since a snapshot is never deleted (only revoked), its hash
   remains available indefinitely as long as the account exists — this is
   intentional, since the hash's entire purpose (per spec §J: "Integrity
   hash for this published passport version") is to let someone verify a
   specific historical version's content didn't change after the fact.

7. **Storage object purge.** No automatic storage-object purge job exists
   today. Proposed default: when a `rights_passport_documents` row is
   deleted (once a delete endpoint is built — see limitation below), the
   corresponding `storage.objects` row under
   `digital-rights-evidence/{user_id}/{passport_key}/{document_id}/` should
   be removed in the same operation (a follow-up `supabaseAdmin.storage
   .remove([...])` call after the DB delete succeeds), to avoid orphaned
   private files. This is a design note for the eventual delete endpoint,
   not something this pass implements.

8. **Legal hold (future capability, not built).** No legal-hold flag exists
   on any Rights Passport table today. A future legal-hold feature would
   need a boolean/timestamp column on the relevant tables (most
   importantly `rights_passport_snapshots` and
   `rights_passport_documents`) that, when set, blocks even an
   admin-initiated purge until cleared — proposed as a small additive
   migration when the capability is actually needed, not preemptively
   built now.

## What this release-candidate pass does NOT implement

- No delete endpoint for any Rights Passport entity (document, asset,
  consent, license, evidence, or workspace passport version) exists today.
  The only removal-shaped operation anywhere in the product is
  `archiveAsset`, which is a status change (`ACTIVE` → `ARCHIVED`), not a
  deletion.
- No scheduled/automatic purge job of any kind exists.
- No legal-hold capability exists.
- No user-facing "delete my Rights Passport data" flow exists beyond
  whatever the platform's existing account-deletion flow already cascades
  via `ON DELETE CASCADE` on `owner_user_id`.

Building any of the above is explicitly out of scope for this pass — this
document exists so that when it's needed, it's built against an approved
policy rather than improvised.
