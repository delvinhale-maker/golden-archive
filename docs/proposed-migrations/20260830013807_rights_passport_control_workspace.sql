-- AurumVault Digital Rights Passport Generator — Round 2: rights-control
-- workspace (AI Consent, License Register, Evidence Register, Risk Review).
-- STATUS: proposed / unapplied. Staged here, not under supabase/migrations/,
-- for the same reason as the Round 1 and Canva migrations: this platform's
-- migration runner applies anything placed under supabase/migrations/
-- immediately against the shared preview+production database.
--
-- Nothing existing is altered: no DROP, no TRUNCATE, no DELETE, no ALTER of
-- any pre-existing table, column, policy, or function (including
-- rights_passports / rights_passport_assets from Round 1). Every new table
-- follows the exact same pattern already established there: references
-- passport_key (not a version-specific id, so records persist across
-- passport version bumps), owner-scoped RLS (genuine RLS, both SELECT and
-- write policies granted to authenticated — matching qr_projects'/Round 1's
-- convention), a guard trigger blocking owner/passport_key reassignment,
-- and a guard trigger verifying the caller actually owns the passport_key
-- being written to.
--
-- SAFETY: nothing here computes or asserts legal ownership, government
-- certification, or legal enforceability. REVIEW_REQUIRED remains a
-- first-class value throughout. Evidence rows never imply proof of
-- ownership by themselves — enforced by never adding a boolean
-- "ownership_confirmed"-shaped column anywhere in this schema.

CREATE TYPE public.rights_ai_use_case AS ENUM (
  'GENERAL_AI_TRAINING', 'FINE_TUNING_CUSTOM_MODEL', 'EMBEDDING_RETRIEVAL', 'VOICE_CLONE',
  'SYNTHETIC_VOICE', 'DIGITAL_REPLICA', 'FACE_LIKENESS_GENERATION', 'SYNTHETIC_VIDEO',
  'MOTION_PERFORMANCE_SIMULATION', 'AVATAR_VIRTUAL_HUMAN', 'GAME_CHARACTER',
  'GENERATED_ADVERTISEMENT', 'PERSONALIZED_CONTENT', 'STYLE_PERSONA_SIMULATION',
  'TRANSLATION_DUBBING', 'AI_REMIX_DERIVATIVE', 'PROMPT_DATASET_EXAMPLE',
  'BENCHMARK_EVALUATION', 'SEARCH_DISCOVERY_INDEXING', 'COMMERCIAL_MODEL_OUTPUT',
  'NONCOMMERCIAL_RESEARCH', 'POSTHUMOUS_ESTATE_USE'
);

-- Shared across AI consent and (as default_ai_policy) rights_passport_assets
-- from Round 1 — same six values, same meaning. Not renamed here so the
-- conflict-detection logic in the risk engine can compare them directly.
CREATE TYPE public.rights_permission AS ENUM (
  'ALLOW', 'ALLOW_WITH_TERMS', 'PROHIBIT', 'CASE_BY_CASE', 'CONTACT_FOR_LICENSE', 'REVIEW_REQUIRED'
);

CREATE TYPE public.rights_license_permission_type AS ENUM (
  'LICENSE', 'CONSENT', 'WAIVER', 'ASSIGNMENT', 'SERVICE_AGREEMENT', 'PLATFORM_TERMS', 'OTHER'
);

CREATE TYPE public.rights_license_status AS ENUM (
  'ACTIVE', 'PENDING', 'EXPIRED', 'REVOKED', 'SUPERSEDED', 'REVIEW_REQUIRED'
);

CREATE TYPE public.rights_evidence_type AS ENUM (
  'SOURCE_FILE', 'CONTRACT', 'COPYRIGHT_REGISTRATION', 'TRADEMARK_REGISTRATION',
  'MODEL_TALENT_RELEASE', 'SPLIT_OWNERSHIP_RECORD', 'IDENTITY_DOCUMENT',
  'CONTENT_CREDENTIAL', 'HASH', 'PUBLICATION_RECORD', 'TIMESTAMP', 'OTHER'
);

CREATE TYPE public.rights_evidence_status AS ENUM (
  'VERIFIED', 'SELF_DECLARED', 'PENDING', 'DISPUTED', 'EXPIRED', 'REVIEW_REQUIRED'
);

CREATE TYPE public.rights_flag_severity AS ENUM ('CRITICAL', 'HIGH', 'MODERATE', 'LOW');

CREATE TYPE public.rights_flag_status AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ACCEPTED_RISK');

-- ==========================================================================
-- rights_ai_consents — AI Consent Builder™. One row per (passport, asset OR
-- passport-wide, use_case) — asset_id nullable means "applies passport-wide
-- unless a more specific asset-level row exists" (the risk engine and UI
-- both read it that way; the DB does not attempt to encode that precedence
-- itself). No default value on `permission` — every row is created with an
-- explicit choice; there is no schema-level default that could silently
-- resolve to ALLOW for an undeclared use.
-- ==========================================================================
CREATE TABLE public.rights_ai_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_key UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID NULL REFERENCES public.rights_passport_assets(id) ON DELETE CASCADE,

  use_case public.rights_ai_use_case NOT NULL,
  permission public.rights_permission NOT NULL,
  compensation_rule TEXT,
  separate_written_consent_required BOOLEAN NOT NULL DEFAULT false,
  human_output_approval_required BOOLEAN NOT NULL DEFAULT false,
  attribution_required BOOLEAN NOT NULL DEFAULT false,
  model_retention_allowed BOOLEAN NOT NULL DEFAULT false,
  derived_model_allowed BOOLEAN NOT NULL DEFAULT false,
  term TEXT,
  territory TEXT,
  revocation_rule TEXT,
  license_contact TEXT,
  evidence_reference TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One declared permission per (passport, asset-or-passport-wide, use case).
  CONSTRAINT rights_ai_consents_unique_scope UNIQUE NULLS NOT DISTINCT (passport_key, asset_id, use_case)
);

CREATE INDEX rights_ai_consents_owner_idx ON public.rights_ai_consents (owner_user_id);
CREATE INDEX rights_ai_consents_key_idx ON public.rights_ai_consents (passport_key);
CREATE INDEX rights_ai_consents_asset_idx ON public.rights_ai_consents (asset_id) WHERE asset_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.rights_ai_consents TO authenticated;
GRANT ALL ON public.rights_ai_consents TO service_role;
REVOKE ALL ON public.rights_ai_consents FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_ai_consents FROM authenticated;

ALTER TABLE public.rights_ai_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rights_ai_consents_owner_read" ON public.rights_ai_consents
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_ai_consents_owner_write" ON public.rights_ai_consents
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rights_ai_consents_updated
  BEFORE UPDATE ON public.rights_ai_consents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ==========================================================================
-- rights_licenses — License Register™.
-- ==========================================================================
CREATE TABLE public.rights_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_key UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.rights_passport_assets(id) ON DELETE CASCADE,

  licensee TEXT NOT NULL,
  exact_use TEXT,
  permission_type public.rights_license_permission_type NOT NULL DEFAULT 'LICENSE',
  start_date DATE,
  end_date DATE,
  territory TEXT,
  is_exclusive BOOLEAN NOT NULL DEFAULT false,
  ai_synthetic_rights_included BOOLEAN,
  compensation TEXT,
  controlling_document_reference TEXT,
  status public.rights_license_status NOT NULL DEFAULT 'REVIEW_REQUIRED',
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rights_licenses_licensee_len CHECK (char_length(licensee) BETWEEN 1 AND 300)
);

CREATE INDEX rights_licenses_owner_idx ON public.rights_licenses (owner_user_id);
CREATE INDEX rights_licenses_key_idx ON public.rights_licenses (passport_key);
CREATE INDEX rights_licenses_asset_idx ON public.rights_licenses (asset_id);

GRANT SELECT, INSERT, UPDATE ON public.rights_licenses TO authenticated;
GRANT ALL ON public.rights_licenses TO service_role;
REVOKE ALL ON public.rights_licenses FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_licenses FROM authenticated;

ALTER TABLE public.rights_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rights_licenses_owner_read" ON public.rights_licenses
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_licenses_owner_write" ON public.rights_licenses
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rights_licenses_updated
  BEFORE UPDATE ON public.rights_licenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ==========================================================================
-- rights_evidence — Provenance & Evidence Register™. Evidence never implies
-- ownership by itself — see the SAFETY note at the top of this file.
-- ==========================================================================
CREATE TABLE public.rights_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_key UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.rights_passport_assets(id) ON DELETE CASCADE,

  evidence_type public.rights_evidence_type NOT NULL,
  source_creator TEXT,
  issued_date DATE,
  file_url TEXT,
  hash_fingerprint TEXT,
  has_content_credential BOOLEAN NOT NULL DEFAULT false,
  credential_manifest_reference TEXT,
  copyright_trademark_reference TEXT,
  identity_evidence_reference TEXT,
  verified_by TEXT,
  verification_date DATE,
  status public.rights_evidence_status NOT NULL DEFAULT 'SELF_DECLARED',
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rights_evidence_owner_idx ON public.rights_evidence (owner_user_id);
CREATE INDEX rights_evidence_key_idx ON public.rights_evidence (passport_key);
CREATE INDEX rights_evidence_asset_idx ON public.rights_evidence (asset_id);

GRANT SELECT, INSERT, UPDATE ON public.rights_evidence TO authenticated;
GRANT ALL ON public.rights_evidence TO service_role;
REVOKE ALL ON public.rights_evidence FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_evidence FROM authenticated;

ALTER TABLE public.rights_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rights_evidence_owner_read" ON public.rights_evidence
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_evidence_owner_write" ON public.rights_evidence
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rights_evidence_updated
  BEFORE UPDATE ON public.rights_evidence
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ==========================================================================
-- rights_review_flags — Risk & Conflict Review™. Rows are produced by the
-- deterministic rule engine (never AI) and reconciled idempotently: the
-- unique constraint below is what prevents duplicates when a rule re-runs.
-- ==========================================================================
CREATE TABLE public.rights_review_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_key UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  rule_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity public.rights_flag_severity NOT NULL,
  affected_entity_type TEXT NOT NULL, -- 'passport' | 'asset' | 'ai_consent' | 'license' | 'evidence'
  affected_entity_id UUID NULL, -- NULL for passport-level flags
  evidence_context TEXT,
  recommended_action TEXT,
  status public.rights_flag_status NOT NULL DEFAULT 'OPEN',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Idempotent re-evaluation key: the same rule, on the same entity, in the
  -- same passport lineage, is always the same row — re-running the engine
  -- upserts, never duplicates.
  CONSTRAINT rights_review_flags_unique_rule UNIQUE NULLS NOT DISTINCT (passport_key, rule_code, affected_entity_type, affected_entity_id)
);

CREATE INDEX rights_review_flags_owner_idx ON public.rights_review_flags (owner_user_id);
CREATE INDEX rights_review_flags_key_idx ON public.rights_review_flags (passport_key);
CREATE INDEX rights_review_flags_open_idx ON public.rights_review_flags (passport_key, status)
  WHERE status IN ('OPEN', 'ACKNOWLEDGED');

GRANT SELECT, INSERT, UPDATE ON public.rights_review_flags TO authenticated;
GRANT ALL ON public.rights_review_flags TO service_role;
REVOKE ALL ON public.rights_review_flags FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_review_flags FROM authenticated;

ALTER TABLE public.rights_review_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rights_review_flags_owner_read" ON public.rights_review_flags
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_review_flags_owner_write" ON public.rights_review_flags
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rights_review_flags_updated
  BEFORE UPDATE ON public.rights_review_flags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ==========================================================================
-- Shared guard triggers — one identity-immutability function and one
-- passport-ownership function per table, mirroring rights_passport_assets'
-- exact pattern from Round 1.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.rights_ai_consents_guard_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'AI consent ownership cannot be reassigned';
  END IF;
  IF NEW.passport_key IS DISTINCT FROM OLD.passport_key THEN
    RAISE EXCEPTION 'AI consent cannot be moved to a different passport';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_ai_consents_guard_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rights_ai_consents_guard_identity_trg
  BEFORE UPDATE ON public.rights_ai_consents
  FOR EACH ROW EXECUTE FUNCTION public.rights_ai_consents_guard_identity();

CREATE OR REPLACE FUNCTION public.rights_licenses_guard_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'License ownership cannot be reassigned';
  END IF;
  IF NEW.passport_key IS DISTINCT FROM OLD.passport_key THEN
    RAISE EXCEPTION 'License cannot be moved to a different passport';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_licenses_guard_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rights_licenses_guard_identity_trg
  BEFORE UPDATE ON public.rights_licenses
  FOR EACH ROW EXECUTE FUNCTION public.rights_licenses_guard_identity();

CREATE OR REPLACE FUNCTION public.rights_evidence_guard_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'Evidence ownership cannot be reassigned';
  END IF;
  IF NEW.passport_key IS DISTINCT FROM OLD.passport_key THEN
    RAISE EXCEPTION 'Evidence cannot be moved to a different passport';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_evidence_guard_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rights_evidence_guard_identity_trg
  BEFORE UPDATE ON public.rights_evidence
  FOR EACH ROW EXECUTE FUNCTION public.rights_evidence_guard_identity();

CREATE OR REPLACE FUNCTION public.rights_review_flags_guard_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'Review flag ownership cannot be reassigned';
  END IF;
  IF NEW.passport_key IS DISTINCT FROM OLD.passport_key THEN
    RAISE EXCEPTION 'Review flag cannot be moved to a different passport';
  END IF;
  IF NEW.rule_code IS DISTINCT FROM OLD.rule_code THEN
    RAISE EXCEPTION 'Review flag rule_code is immutable';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_review_flags_guard_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rights_review_flags_guard_identity_trg
  BEFORE UPDATE ON public.rights_review_flags
  FOR EACH ROW EXECUTE FUNCTION public.rights_review_flags_guard_identity();

-- Passport-ownership guards: a row can only ever be attached to a
-- passport_key the same owner_user_id actually controls (mirrors
-- rights_passport_assets_guard_passport_owner exactly).
CREATE OR REPLACE FUNCTION public.rights_workspace_guard_passport_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  passport_owner UUID;
BEGIN
  SELECT owner_user_id INTO passport_owner
  FROM public.rights_passports
  WHERE passport_key = NEW.passport_key
  LIMIT 1;

  IF passport_owner IS NULL THEN
    RAISE EXCEPTION 'Passport not found';
  END IF;

  IF passport_owner IS DISTINCT FROM NEW.owner_user_id THEN
    RAISE EXCEPTION 'A record can only be attached to a passport you own';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_workspace_guard_passport_owner() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rights_ai_consents_guard_passport_owner_trg
  BEFORE INSERT OR UPDATE OF passport_key, owner_user_id ON public.rights_ai_consents
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_passport_owner();

CREATE TRIGGER rights_licenses_guard_passport_owner_trg
  BEFORE INSERT OR UPDATE OF passport_key, owner_user_id ON public.rights_licenses
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_passport_owner();

CREATE TRIGGER rights_evidence_guard_passport_owner_trg
  BEFORE INSERT OR UPDATE OF passport_key, owner_user_id ON public.rights_evidence
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_passport_owner();

CREATE TRIGGER rights_review_flags_guard_passport_owner_trg
  BEFORE INSERT OR UPDATE OF passport_key, owner_user_id ON public.rights_review_flags
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_passport_owner();

-- Defense in depth beyond the FK: an asset_id attached to a consent/
-- license/evidence row must belong to the SAME passport_key as the row
-- itself — the FK alone only guarantees the asset exists somewhere, not
-- that it's the caller's own asset in this passport's lineage.
CREATE OR REPLACE FUNCTION public.rights_workspace_guard_asset_passport()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  asset_passport_key UUID;
BEGIN
  IF NEW.asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT passport_key INTO asset_passport_key
  FROM public.rights_passport_assets
  WHERE id = NEW.asset_id;

  IF asset_passport_key IS NULL THEN
    RAISE EXCEPTION 'Asset not found';
  END IF;

  IF asset_passport_key IS DISTINCT FROM NEW.passport_key THEN
    RAISE EXCEPTION 'Asset does not belong to this passport';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_workspace_guard_asset_passport() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rights_ai_consents_guard_asset_passport_trg
  BEFORE INSERT OR UPDATE OF asset_id, passport_key ON public.rights_ai_consents
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_asset_passport();

CREATE TRIGGER rights_licenses_guard_asset_passport_trg
  BEFORE INSERT OR UPDATE OF asset_id, passport_key ON public.rights_licenses
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_asset_passport();

CREATE TRIGGER rights_evidence_guard_asset_passport_trg
  BEFORE INSERT OR UPDATE OF asset_id, passport_key ON public.rights_evidence
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_asset_passport();
