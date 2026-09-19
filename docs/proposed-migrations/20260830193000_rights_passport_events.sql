-- AurumVault Digital Rights Passport Generator — release-candidate
-- observability. STATUS: proposed / unapplied, same reason as every prior
-- rights-passport migration (this platform's migration runner applies
-- anything under supabase/migrations/ immediately against the shared
-- preview+production database).
--
-- Nothing existing is altered: no DROP, no TRUNCATE, no DELETE, no ALTER of
-- any pre-existing table, column, policy, or function.
--
-- SEARCH-FIRST NOTE: reuses the shape of the existing `merch_events` table
-- (supabase/migrations/20260822132317_17bb558a-2249-41b0-ac2f-ecbc18b7b834.sql,
-- lines 104-127) — a single flat event table with a CHECK-constrained
-- `kind` column, a JSONB detail column, and admin-only read. One
-- deliberate difference: merch_events is public marketing telemetry
-- (anonymous impressions/clicks), so it grants INSERT to `anon`; every
-- Rights Passport event originates from an already-authenticated action,
-- so INSERT here is `authenticated`-only and owner-scoped, matching every
-- other Rights Passport table's RLS convention instead.
--
-- SAFETY: `detail` is a JSONB column populated only by the fixed,
-- allowlisted set of safe fields documented in rights-passport-events.ts
-- (RightsPassportEventDetail) — never raw document content, prompts,
-- contract text, storage paths, or signed URLs. This is an application-
-- layer discipline (like every other privacy boundary in this codebase),
-- not something the CHECK constraint below can enforce structurally; see
-- the release report's Phase 9 section for the explicit "never log" list
-- this module is built to honor.

CREATE TABLE public.rights_passport_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passport_key UUID,
  kind TEXT NOT NULL,
  detail JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rights_passport_events_kind_chk CHECK (
    kind IN (
      'rights_passport_created',
      'rights_asset_added',
      'rights_ai_consent_updated',
      'rights_license_added',
      'rights_evidence_added',
      'rights_document_uploaded',
      'rights_parse_failed',
      'rights_analysis_started',
      'rights_analysis_pass_failed',
      'rights_analysis_completed',
      'rights_finding_reviewed',
      'rights_publish_blocked',
      'rights_passport_published',
      'rights_passport_revoked',
      'rights_export_failed'
    )
  )
);

CREATE INDEX rights_passport_events_owner_idx ON public.rights_passport_events (owner_user_id, created_at DESC);
CREATE INDEX rights_passport_events_kind_idx ON public.rights_passport_events (kind, created_at DESC);

GRANT SELECT, INSERT ON public.rights_passport_events TO authenticated;
GRANT ALL ON public.rights_passport_events TO service_role;
REVOKE ALL ON public.rights_passport_events FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_passport_events FROM authenticated;

ALTER TABLE public.rights_passport_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rights_passport_events_owner_read" ON public.rights_passport_events
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_passport_events_owner_insert" ON public.rights_passport_events
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

-- No UPDATE policy at all — events are append-only, matching merch_events'
-- own convention (it has no UPDATE policy either) and this codebase's
-- general audit-log expectation that a logged event is never revised.
