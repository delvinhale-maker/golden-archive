-- AurumVault Digital Rights Passport Generator — Round 3: Upload & Analyze
-- (document ingestion, multi-pass AI extraction, evidence-grounded review
-- queue). STATUS: proposed / unapplied. Staged here, not under
-- supabase/migrations/, for the same reason as every prior rights-passport
-- migration: this platform's migration runner applies anything placed under
-- supabase/migrations/ immediately against the shared preview+production
-- database. This file must not be applied without separate explicit
-- authorization — including the storage.buckets insert at the bottom.
--
-- Nothing existing is altered: no DROP, no TRUNCATE, no DELETE, no ALTER of
-- any pre-existing table, column, policy, or function (Round 1/2 tables
-- included). Ownership/RLS follows the exact pattern established in Round 2
-- (docs/proposed-migrations/20260830013807_rights_passport_control_workspace.sql):
-- owner-scoped RLS, a passport-ownership guard trigger, an
-- identity-immutability guard trigger. Two NEW generic guard functions are
-- added for the document/run reference chain (documents -> runs ->
-- findings), following the same shape as the Round 2 asset-ownership guard.
--
-- SAFETY: an AI finding is data, never a verified fact. Findings live in
-- rights_analysis_findings with review_status defaulting to PENDING; nothing
-- in this schema writes to rights_ai_consents / rights_licenses /
-- rights_evidence / rights_passport_assets automatically. Only the
-- reviewFinding server function (Round 3 application code, not this
-- migration) may do that, and only after an explicit user ACCEPT — this
-- migration only enforces that findings.applied_entity_type/_id start NULL
-- and that review_status starts PENDING; it cannot and does not enforce the
-- accept-before-apply workflow itself (that is application-layer, verified
-- by tests).

CREATE TYPE public.rights_document_type AS ENUM (
  'LICENSING_AGREEMENT', 'ENDORSEMENT_AGREEMENT', 'MUSIC_AGREEMENT', 'CREATOR_AGREEMENT',
  'TALENT_RELEASE', 'ASSIGNMENT', 'BRAND_AGREEMENT', 'REGISTRATION', 'EVIDENCE_DOCUMENT',
  'PLATFORM_TERMS', 'OTHER'
);

-- Document lifecycle. EMPTY and UPLOADING are client-only states (before a
-- row exists / while the storage upload is in flight) and never appear here.
CREATE TYPE public.rights_document_status AS ENUM (
  'UPLOADED', 'PARSING', 'PARSED', 'ANALYZING', 'REVIEW_REQUIRED', 'READY_FOR_REVIEW',
  'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'FAILED'
);

CREATE TYPE public.rights_parse_status AS ENUM (
  'PENDING', 'PARSING', 'PARSED', 'OCR_REQUIRED', 'FAILED'
);

CREATE TYPE public.rights_analysis_status AS ENUM (
  'PENDING', 'ANALYZING', 'COMPLETE', 'PARTIAL', 'FAILED'
);

CREATE TYPE public.rights_analysis_run_status AS ENUM (
  'PENDING', 'RUNNING', 'COMPLETE', 'PARTIAL', 'FAILED'
);

CREATE TYPE public.rights_analysis_pass_type AS ENUM (
  'DOCUMENT_STRUCTURE', 'RIGHTS_GRANT', 'AI_SYNTHETIC_RIGHTS', 'COMMERCIAL_TERMS',
  'RISK_CONFLICT_SIGNALS'
);

CREATE TYPE public.rights_finding_review_status AS ENUM (
  'PENDING', 'ACCEPTED', 'EDITED', 'REJECTED', 'DEFERRED'
);

-- ==========================================================================
-- rights_passport_documents — uploaded source documents. storage_path is
-- never returned to the client directly by any server function; access is
-- always mediated through a short-lived signed URL issued server-side after
-- an ownership check (see rights-passport-documents.functions.ts).
-- ==========================================================================
CREATE TABLE public.rights_passport_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_key UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  file_name TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  document_type public.rights_document_type NOT NULL DEFAULT 'OTHER',
  status public.rights_document_status NOT NULL DEFAULT 'UPLOADED',
  page_count INT,
  parse_status public.rights_parse_status NOT NULL DEFAULT 'PENDING',
  analysis_status public.rights_analysis_status NOT NULL DEFAULT 'PENDING',
  -- Page-chunked parsed text: [{ page, section, text, charStart, charEnd }].
  -- Private, RLS-protected, never returned wholesale to the client — only
  -- short quotes surfaced via a finding's `source.quote` are shown in the UI.
  parsed_content JSONB,

  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  parsed_at TIMESTAMPTZ,
  analyzed_at TIMESTAMPTZ,
  error_code TEXT,
  error_message_safe TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rights_passport_documents_mime_allowed CHECK (
    mime_type IN (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    )
  ),
  CONSTRAINT rights_passport_documents_size_bounds CHECK (
    file_size_bytes > 0 AND file_size_bytes <= 52428800 -- 50 MB
  ),
  CONSTRAINT rights_passport_documents_original_name_len CHECK (
    char_length(original_file_name) BETWEEN 1 AND 300
  )
);

CREATE INDEX rights_passport_documents_owner_idx ON public.rights_passport_documents (owner_user_id);
CREATE INDEX rights_passport_documents_key_idx ON public.rights_passport_documents (passport_key);

GRANT SELECT, INSERT, UPDATE ON public.rights_passport_documents TO authenticated;
GRANT ALL ON public.rights_passport_documents TO service_role;
REVOKE ALL ON public.rights_passport_documents FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_passport_documents FROM authenticated;

ALTER TABLE public.rights_passport_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rights_passport_documents_owner_read" ON public.rights_passport_documents
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_passport_documents_owner_write" ON public.rights_passport_documents
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rights_passport_documents_updated
  BEFORE UPDATE ON public.rights_passport_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ==========================================================================
-- rights_analysis_runs — one row per multi-pass analysis attempt over a
-- document. pass_status tracks each of the 5 passes independently so a
-- single failed pass can be retried without discarding the others (see
-- module docstring in rights-passport-analysis.functions.ts).
-- ==========================================================================
CREATE TABLE public.rights_analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_key UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.rights_passport_documents(id) ON DELETE CASCADE,

  status public.rights_analysis_run_status NOT NULL DEFAULT 'PENDING',
  -- { DOCUMENT_STRUCTURE: 'COMPLETE', RIGHTS_GRANT: 'FAILED', ... }
  pass_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT,
  provider TEXT NOT NULL DEFAULT 'anthropic',
  schema_version TEXT NOT NULL DEFAULT 'v1',

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_code TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rights_analysis_runs_owner_idx ON public.rights_analysis_runs (owner_user_id);
CREATE INDEX rights_analysis_runs_key_idx ON public.rights_analysis_runs (passport_key);
CREATE INDEX rights_analysis_runs_document_idx ON public.rights_analysis_runs (document_id);

GRANT SELECT, INSERT, UPDATE ON public.rights_analysis_runs TO authenticated;
GRANT ALL ON public.rights_analysis_runs TO service_role;
REVOKE ALL ON public.rights_analysis_runs FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_analysis_runs FROM authenticated;

ALTER TABLE public.rights_analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rights_analysis_runs_owner_read" ON public.rights_analysis_runs
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_analysis_runs_owner_write" ON public.rights_analysis_runs
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rights_analysis_runs_updated
  BEFORE UPDATE ON public.rights_analysis_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ==========================================================================
-- rights_analysis_findings — evidence-grounded, per-field AI output. Never
-- written directly to rights assets/AI consent/licenses/evidence; a finding
-- only reaches those tables via the user-confirmed reviewFinding("ACCEPT")
-- path (application-layer). finding_key is the deterministic idempotency
-- key (pass_type::field::sourceSignature) — the unique constraint below is
-- what makes a retried pass upsert-safe rather than duplicate-producing.
-- ==========================================================================
CREATE TABLE public.rights_analysis_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID NOT NULL REFERENCES public.rights_analysis_runs(id) ON DELETE CASCADE,
  passport_key UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.rights_passport_documents(id) ON DELETE CASCADE,

  finding_key TEXT NOT NULL,
  pass_type public.rights_analysis_pass_type NOT NULL,
  field TEXT NOT NULL,
  normalized_value JSONB,
  raw_value TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  source JSONB,
  review_required BOOLEAN NOT NULL DEFAULT true,
  review_reason TEXT,
  suggested_target JSONB,

  review_status public.rights_finding_review_status NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  -- The user's corrected value on EDIT — kept distinct from normalized_value
  -- (the AI's original output) so accept-mapping always applies the right
  -- one and the original AI suggestion stays auditable.
  edited_value JSONB,
  applied_entity_type TEXT,
  applied_entity_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rights_analysis_findings_confidence_range CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT rights_analysis_findings_unique_key UNIQUE (analysis_run_id, finding_key)
);

CREATE INDEX rights_analysis_findings_owner_idx ON public.rights_analysis_findings (owner_user_id);
CREATE INDEX rights_analysis_findings_key_idx ON public.rights_analysis_findings (passport_key);
CREATE INDEX rights_analysis_findings_run_idx ON public.rights_analysis_findings (analysis_run_id);
CREATE INDEX rights_analysis_findings_document_idx ON public.rights_analysis_findings (document_id);
CREATE INDEX rights_analysis_findings_pending_idx ON public.rights_analysis_findings (passport_key, review_status)
  WHERE review_status = 'PENDING';

GRANT SELECT, INSERT, UPDATE ON public.rights_analysis_findings TO authenticated;
GRANT ALL ON public.rights_analysis_findings TO service_role;
REVOKE ALL ON public.rights_analysis_findings FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_analysis_findings FROM authenticated;

ALTER TABLE public.rights_analysis_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rights_analysis_findings_owner_read" ON public.rights_analysis_findings
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_analysis_findings_owner_write" ON public.rights_analysis_findings
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rights_analysis_findings_updated
  BEFORE UPDATE ON public.rights_analysis_findings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ==========================================================================
-- Guard triggers — identity immutability (per table) + ownership chain
-- (documents -> passport; runs -> passport + document; findings -> passport
-- + document + run). rights_workspace_guard_passport_owner() is REUSED
-- as-is from the Round 2 migration (it only depends on
-- public.rights_passports, which already exists) — not redefined here.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.rights_passport_documents_guard_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'Document ownership cannot be reassigned';
  END IF;
  IF NEW.passport_key IS DISTINCT FROM OLD.passport_key THEN
    RAISE EXCEPTION 'Document cannot be moved to a different passport';
  END IF;
  IF NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    RAISE EXCEPTION 'Document storage_path is immutable';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_passport_documents_guard_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rights_passport_documents_guard_identity_trg
  BEFORE UPDATE ON public.rights_passport_documents
  FOR EACH ROW EXECUTE FUNCTION public.rights_passport_documents_guard_identity();

CREATE TRIGGER rights_passport_documents_guard_passport_owner_trg
  BEFORE INSERT OR UPDATE OF passport_key, owner_user_id ON public.rights_passport_documents
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_passport_owner();

CREATE OR REPLACE FUNCTION public.rights_analysis_runs_guard_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'Analysis run ownership cannot be reassigned';
  END IF;
  IF NEW.passport_key IS DISTINCT FROM OLD.passport_key THEN
    RAISE EXCEPTION 'Analysis run cannot be moved to a different passport';
  END IF;
  IF NEW.document_id IS DISTINCT FROM OLD.document_id THEN
    RAISE EXCEPTION 'Analysis run cannot be moved to a different document';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_analysis_runs_guard_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rights_analysis_runs_guard_identity_trg
  BEFORE UPDATE ON public.rights_analysis_runs
  FOR EACH ROW EXECUTE FUNCTION public.rights_analysis_runs_guard_identity();

CREATE TRIGGER rights_analysis_runs_guard_passport_owner_trg
  BEFORE INSERT OR UPDATE OF passport_key, owner_user_id ON public.rights_analysis_runs
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_passport_owner();

-- Verifies document_id belongs to the same passport_key as the run itself —
-- the FK alone only guarantees the document exists somewhere, not that it's
-- the caller's own document in this passport's lineage.
CREATE OR REPLACE FUNCTION public.rights_workspace_guard_document_passport()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  doc_passport_key UUID;
BEGIN
  SELECT passport_key INTO doc_passport_key
  FROM public.rights_passport_documents
  WHERE id = NEW.document_id;

  IF doc_passport_key IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  IF doc_passport_key IS DISTINCT FROM NEW.passport_key THEN
    RAISE EXCEPTION 'Document does not belong to this passport';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_workspace_guard_document_passport() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rights_analysis_runs_guard_document_passport_trg
  BEFORE INSERT OR UPDATE OF document_id, passport_key ON public.rights_analysis_runs
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_document_passport();

CREATE TRIGGER rights_analysis_findings_guard_document_passport_trg
  BEFORE INSERT OR UPDATE OF document_id, passport_key ON public.rights_analysis_findings
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_document_passport();

CREATE OR REPLACE FUNCTION public.rights_analysis_findings_guard_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'Finding ownership cannot be reassigned';
  END IF;
  IF NEW.passport_key IS DISTINCT FROM OLD.passport_key THEN
    RAISE EXCEPTION 'Finding cannot be moved to a different passport';
  END IF;
  IF NEW.analysis_run_id IS DISTINCT FROM OLD.analysis_run_id THEN
    RAISE EXCEPTION 'Finding cannot be moved to a different analysis run';
  END IF;
  IF NEW.document_id IS DISTINCT FROM OLD.document_id THEN
    RAISE EXCEPTION 'Finding cannot be moved to a different document';
  END IF;
  IF NEW.finding_key IS DISTINCT FROM OLD.finding_key THEN
    RAISE EXCEPTION 'Finding key is immutable';
  END IF;
  IF NEW.normalized_value IS DISTINCT FROM OLD.normalized_value THEN
    RAISE EXCEPTION 'A finding''s AI-extracted value cannot be edited in place — record corrections in edited_value';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_analysis_findings_guard_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rights_analysis_findings_guard_identity_trg
  BEFORE UPDATE ON public.rights_analysis_findings
  FOR EACH ROW EXECUTE FUNCTION public.rights_analysis_findings_guard_identity();

CREATE TRIGGER rights_analysis_findings_guard_passport_owner_trg
  BEFORE INSERT OR UPDATE OF passport_key, owner_user_id ON public.rights_analysis_findings
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_passport_owner();

-- Verifies analysis_run_id belongs to the same passport_key AND document_id
-- as the finding itself.
CREATE OR REPLACE FUNCTION public.rights_workspace_guard_run_passport()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  run_passport_key UUID;
  run_document_id UUID;
BEGIN
  SELECT passport_key, document_id INTO run_passport_key, run_document_id
  FROM public.rights_analysis_runs
  WHERE id = NEW.analysis_run_id;

  IF run_passport_key IS NULL THEN
    RAISE EXCEPTION 'Analysis run not found';
  END IF;

  IF run_passport_key IS DISTINCT FROM NEW.passport_key THEN
    RAISE EXCEPTION 'Analysis run does not belong to this passport';
  END IF;

  IF run_document_id IS DISTINCT FROM NEW.document_id THEN
    RAISE EXCEPTION 'Analysis run does not belong to this document';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_workspace_guard_run_passport() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rights_analysis_findings_guard_run_passport_trg
  BEFORE INSERT OR UPDATE OF analysis_run_id, passport_key, document_id ON public.rights_analysis_findings
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_run_passport();

-- ==========================================================================
-- Storage — digital-rights-evidence bucket. PRIVATE. Path convention:
-- {user_id}/{passport_key}/{document_id}/{sanitized_filename} — the same
-- "first folder segment = auth.uid()" ownership convention already used by
-- the product-files bucket, so the RLS below mirrors that bucket's policies
-- exactly. No anon policy exists anywhere in this section.
--
-- DO NOT APPLY THIS SECTION (or any part of this file) to shared
-- Lovable/Supabase infrastructure without separate explicit authorization —
-- this includes the storage.buckets insert, which this round's spec
-- explicitly says must not be applied to production yet.
-- ==========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'digital-rights-evidence',
  'digital-rights-evidence',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "rights_evidence_docs_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'digital-rights-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "rights_evidence_docs_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'digital-rights-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "rights_evidence_docs_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'digital-rights-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "rights_evidence_docs_owner_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'digital-rights-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
