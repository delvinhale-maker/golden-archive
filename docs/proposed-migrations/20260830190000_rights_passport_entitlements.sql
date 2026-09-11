-- AurumVault Digital Rights Passport Generator — release-candidate
-- entitlements. STATUS: proposed / unapplied, same reason as every prior
-- rights-passport migration: this platform's migration runner applies
-- anything under supabase/migrations/ immediately against the shared
-- preview+production database (confirmed by the applied precedent —
-- see docs/proposed-migrations/20260828004015_create_integration_connections.sql).
--
-- Nothing existing is altered: no DROP, no TRUNCATE, no DELETE, no ALTER of
-- any pre-existing table, column, policy, or function.
--
-- SEARCH-FIRST NOTE: there is no existing subscription/entitlement/plan
-- table anywhere in this codebase (confirmed by a dedicated audit pass —
-- the existing Stripe integration is a one-time marketplace-checkout
-- system, not a billing-tier system). This table's shape deliberately
-- mirrors the one genuinely analogous existing pattern, `user_roles` (the
-- backing table for `public.has_role()`): a small per-user row, read via a
-- safe-default lookup function, writable only by service_role.
--
-- WHY NO SEPARATE "USAGE" TABLE: every numeric capability in
-- rights-passport-plans.ts is derivable by COUNT/SUM against tables that
-- already exist (rights_passports, rights_passport_assets,
-- rights_passport_documents, rights_analysis_runs,
-- rights_passport_snapshots) — see getRightsPassportUsage() in
-- rights-passport-entitlements.functions.ts. Adding a second, independently
-- mutable "usage counter" table would create a reconciliation problem
-- (counters can drift from reality) for no benefit, so this migration adds
-- only the one thing that has no existing source of truth: which plan a
-- user is on.
--
-- SAFETY: a user cannot self-assign or change their own plan — INSERT and
-- UPDATE are granted to service_role only. A missing row is a deliberate,
-- safe default (FREE_PREVIEW, the most restrictive tier), enforced in
-- application code (getUserPlan()), not by a DB default value, so the
-- fail-safe behavior is visible and testable independent of the schema.

CREATE TYPE public.rights_passport_plan AS ENUM (
  'FREE_PREVIEW', 'PERSONAL', 'PROFESSIONAL', 'BUSINESS'
);

CREATE TABLE public.rights_passport_entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.rights_passport_plan NOT NULL DEFAULT 'FREE_PREVIEW',

  -- Free-text, informational only — e.g. a future Stripe subscription id or
  -- an admin's note on why a plan was granted. Never parsed or trusted by
  -- application logic; the `plan` column alone is the source of truth.
  source_reference TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rights_passport_entitlements TO authenticated;
GRANT ALL ON public.rights_passport_entitlements TO service_role;
REVOKE ALL ON public.rights_passport_entitlements FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.rights_passport_entitlements FROM authenticated;

ALTER TABLE public.rights_passport_entitlements ENABLE ROW LEVEL SECURITY;

-- Owner-only read (a user can see their own plan). No write policy for
-- `authenticated` at all — plan changes are a service_role/admin operation
-- only, matching the GRANT above (belt-and-suspenders: RLS would block it
-- even if a future migration accidentally widened the GRANT).
CREATE POLICY "rights_passport_entitlements_owner_read" ON public.rights_passport_entitlements
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rights_passport_entitlements_updated
  BEFORE UPDATE ON public.rights_passport_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
