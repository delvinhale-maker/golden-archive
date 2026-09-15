-- AurumVault Digital Rights Passport Generator — targeted RLS hardening.
-- STATUS: proposed / unapplied to production. Written and verified against
-- the isolated staging project (Supabase ref ypelutaddlibqvpaekyq,
-- "aurumvault-staging") — NOT applied there by this session; see the
-- accompanying report for exactly what was and wasn't done.
--
-- Nothing existing is altered except the two named policies below: no
-- DROP TABLE, no TRUNCATE, no DELETE, no destructive ALTER, no column/
-- trigger/index/function change of any kind.
--
-- WHY: rights_passports_owner_write and rights_passport_snapshots_owner_write
-- are both `FOR ALL` policies. `FOR ALL` includes DELETE — even though no
-- DELETE table privilege is currently granted to `authenticated` on either
-- table (verified directly against the live staging database via
-- information_schema.role_table_grants before writing this migration: only
-- INSERT/SELECT/UPDATE are granted to `authenticated`; DELETE exists only
-- for `service_role`, which bypasses RLS entirely and is out of scope
-- here), an `ALL` policy is latent risk: if a future migration ever grants
-- DELETE to `authenticated` on either table without separately auditing
-- RLS, that grant would immediately become exploitable through the
-- existing owner/admin `ALL` policy with no additional review step. This
-- migration removes that latent path by replacing each `ALL` policy with
-- exactly the two operations still actually needed (INSERT, UPDATE) and
-- creating no DELETE policy — so even a future stray DELETE grant would
-- still be denied by RLS (no policy exists to authorize it) until DELETE
-- is a deliberate, separately-reviewed decision.
--
-- SAFETY: the owner/admin authorization predicate
-- `(owner_user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)`
-- is preserved byte-for-byte from the existing `_owner_write` policies —
-- confirmed against both the original migration source
-- (docs/proposed-migrations/20260829213658_create_rights_passport.sql,
-- docs/proposed-migrations/20260830150000_rights_passport_publishing.sql)
-- and the live policy definitions on staging (pg_policies). SELECT
-- policies, rights_passport_public_identities (already explicit
-- INSERT+SELECT, no ALL policy — confirmed unchanged, not touched here),
-- table grants, the snapshot immutability guard trigger, the
-- one-ACTIVE-snapshot-per-lineage partial unique index, and every other
-- object are untouched.
--
-- No REVOKE statement is added: DELETE privilege was independently
-- verified NOT to exist for `authenticated` on either table before writing
-- this file (see above), so there is nothing to revoke — adding one would
-- be a no-op at best and, per the task's own instruction, is only
-- warranted if DELETE privilege is independently verified to exist, which
-- it is not.

-- ============================================================================
-- rights_passports
-- ============================================================================
DROP POLICY IF EXISTS "rights_passports_owner_write" ON public.rights_passports;

CREATE POLICY "rights_passports_owner_insert" ON public.rights_passports
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_passports_owner_update" ON public.rights_passports
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- rights_passport_snapshots
-- ============================================================================
DROP POLICY IF EXISTS "rights_passport_snapshots_owner_write" ON public.rights_passport_snapshots;

CREATE POLICY "rights_passport_snapshots_owner_insert" ON public.rights_passport_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_passport_snapshots_owner_update" ON public.rights_passport_snapshots
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- No DELETE policy is created for either table (intentional — see header).
-- The existing rights_passport_snapshots_guard_immutable_trg trigger
-- (docs/proposed-migrations/20260830150000_rights_passport_publishing.sql)
-- is untouched and continues to restrict UPDATE at the column level
-- (only status/revoked_at may ever change on a snapshot row) independent
-- of and in addition to this RLS change.
