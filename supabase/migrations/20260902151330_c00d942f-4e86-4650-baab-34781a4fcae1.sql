-- Audiobook Studio Phase 1: additive schema foundation. No existing objects altered.

CREATE TYPE public.audiobook_job_status AS ENUM ('QUEUED','GENERATING','COMPLETED','FAILED','CANCELLED','RETRYING');
CREATE TYPE public.audiobook_usage_kind AS ENUM ('ESTIMATE','ACTUAL');
CREATE TYPE public.audiobook_attestation_status AS ENUM ('PENDING','ATTESTED','REVOKED');

-- 1. projects
CREATE TABLE public.audiobook_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  author_name text,
  description text,
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'DRAFT',
  source_product_id uuid REFERENCES public.marketplace_products(id) ON DELETE SET NULL,
  metadata_imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audiobook_projects_owner_idx ON public.audiobook_projects(owner_id, created_at DESC);

-- 2. sources (manuscripts)
CREATE TABLE public.audiobook_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.audiobook_projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'audiobook-manuscripts',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  checksum_sha256 text,
  word_count integer,
  page_count integer,
  validation_status text NOT NULL DEFAULT 'PENDING',
  validation_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audiobook_sources_project_idx ON public.audiobook_sources(project_id);
CREATE INDEX audiobook_sources_owner_idx ON public.audiobook_sources(owner_id);

-- 3. chapters
CREATE TABLE public.audiobook_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.audiobook_projects(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.audiobook_sources(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_index integer NOT NULL,
  title text,
  original_text text NOT NULL,
  char_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, chapter_index)
);
CREATE INDEX audiobook_chapters_owner_idx ON public.audiobook_chapters(owner_id);

CREATE OR REPLACE FUNCTION public.audiobook_chapters_guard_original_text()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.original_text IS DISTINCT FROM OLD.original_text THEN
    RAISE EXCEPTION 'audiobook_chapters.original_text is immutable; store edits in audiobook_chapter_versions';
  END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'audiobook_chapters ownership is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER audiobook_chapters_guard_original_text
BEFORE UPDATE ON public.audiobook_chapters
FOR EACH ROW EXECUTE FUNCTION public.audiobook_chapters_guard_original_text();

-- 4. chapter versions
CREATE TABLE public.audiobook_chapter_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.audiobook_chapters(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.audiobook_projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  edited_text text NOT NULL,
  change_note text,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, version)
);
CREATE UNIQUE INDEX audiobook_chapter_versions_current_idx
  ON public.audiobook_chapter_versions(chapter_id) WHERE is_current;

-- 5. voice configs
CREATE TABLE public.audiobook_voice_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.audiobook_projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default voice',
  provider text NOT NULL DEFAULT 'mock',
  model text,
  voice_id text,
  speed numeric(4,2) NOT NULL DEFAULT 1.00,
  style text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX audiobook_voice_configs_default_idx
  ON public.audiobook_voice_configs(project_id) WHERE is_default;

-- 6. pronunciations
CREATE TABLE public.audiobook_pronunciations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.audiobook_projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term text NOT NULL,
  replacement text,
  ipa text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX audiobook_pronunciations_term_idx
  ON public.audiobook_pronunciations(project_id, lower(term));

-- 7. generation jobs
CREATE TABLE public.audiobook_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.audiobook_projects(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.audiobook_chapters(id) ON DELETE CASCADE,
  chapter_version_id uuid REFERENCES public.audiobook_chapter_versions(id) ON DELETE SET NULL,
  voice_config_id uuid REFERENCES public.audiobook_voice_configs(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.audiobook_job_status NOT NULL DEFAULT 'QUEUED',
  attempt integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  idempotency_key text NOT NULL,
  provider text NOT NULL DEFAULT 'mock',
  model text,
  requested_characters integer NOT NULL DEFAULT 0,
  error_message text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, idempotency_key)
);
CREATE INDEX audiobook_generation_jobs_project_idx ON public.audiobook_generation_jobs(project_id, status);

-- 8. audio assets
CREATE TABLE public.audiobook_audio_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.audiobook_projects(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.audiobook_chapters(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.audiobook_generation_jobs(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  storage_bucket text NOT NULL DEFAULT 'audiobook-audio',
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'audio/mpeg',
  duration_seconds numeric(10,2),
  file_size_bytes bigint NOT NULL DEFAULT 0,
  sample_rate integer,
  checksum_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX audiobook_audio_assets_chapter_version_idx
  ON public.audiobook_audio_assets(chapter_id, version) WHERE chapter_id IS NOT NULL;
CREATE UNIQUE INDEX audiobook_audio_assets_chapter_current_idx
  ON public.audiobook_audio_assets(chapter_id) WHERE chapter_id IS NOT NULL AND is_current;
CREATE UNIQUE INDEX audiobook_audio_assets_project_current_idx
  ON public.audiobook_audio_assets(project_id) WHERE chapter_id IS NULL AND is_current;

-- 9. usage
CREATE TABLE public.audiobook_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.audiobook_projects(id) ON DELETE SET NULL,
  chapter_id uuid REFERENCES public.audiobook_chapters(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.audiobook_generation_jobs(id) ON DELETE SET NULL,
  kind public.audiobook_usage_kind NOT NULL,
  provider text NOT NULL DEFAULT 'mock',
  model text,
  characters bigint NOT NULL DEFAULT 0,
  duration_seconds numeric(10,2),
  cost_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audiobook_usage_owner_idx ON public.audiobook_usage(owner_id, created_at DESC);
CREATE UNIQUE INDEX audiobook_usage_actual_job_idx
  ON public.audiobook_usage(job_id) WHERE job_id IS NOT NULL AND kind = 'ACTUAL';

-- 10. rights attestations
CREATE TABLE public.audiobook_rights_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.audiobook_projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.audiobook_attestation_status NOT NULL DEFAULT 'PENDING',
  version integer NOT NULL DEFAULT 1,
  statement_text text,
  attested_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

-- 11. activity events (append-only)
CREATE TABLE public.audiobook_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid,
  project_id uuid REFERENCES public.audiobook_projects(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.audiobook_generation_jobs(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audiobook_activity_events_project_idx ON public.audiobook_activity_events(project_id, created_at DESC);

-- 12. QC runs
CREATE TABLE public.audiobook_qc_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.audiobook_projects(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.audiobook_chapters(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'QUEUED',
  overall_result text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audiobook_qc_runs_project_idx ON public.audiobook_qc_runs(project_id, created_at DESC);

-- 13. QC results
CREATE TABLE public.audiobook_qc_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qc_run_id uuid NOT NULL REFERENCES public.audiobook_qc_runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_code text NOT NULL,
  severity text NOT NULL DEFAULT 'INFO',
  passed boolean NOT NULL DEFAULT true,
  detail text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audiobook_qc_results_run_idx ON public.audiobook_qc_results(qc_run_id);

-- 14. metadata (cover binaries reuse the existing product-covers lifecycle)
CREATE TABLE public.audiobook_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.audiobook_projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  subtitle text,
  author_name text,
  narrator_name text,
  publisher text,
  description text,
  language text NOT NULL DEFAULT 'en',
  isbn text,
  genre text,
  keywords text[] NOT NULL DEFAULT '{}'::text[],
  cover_bucket text NOT NULL DEFAULT 'product-covers',
  cover_path text,
  copyright_year integer,
  completeness_score integer NOT NULL DEFAULT 0,
  is_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grants, RLS, owner policies, updated_at triggers
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'audiobook_projects','audiobook_sources','audiobook_chapters','audiobook_chapter_versions',
  'audiobook_voice_configs','audiobook_pronunciations','audiobook_generation_jobs',
  'audiobook_audio_assets','audiobook_usage','audiobook_rights_attestations',
  'audiobook_qc_runs','audiobook_qc_results','audiobook_metadata'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), ''admin''::app_role))', t||'_owner_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid())', t||'_owner_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())', t||'_owner_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (owner_id = auth.uid())', t||'_owner_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp()', t||'_set_updated_at', t);
  END LOOP;
END $$;

-- audiobook_qc_results and audiobook_activity_events have no updated_at column
DROP TRIGGER IF EXISTS audiobook_qc_results_set_updated_at ON public.audiobook_qc_results;

-- Activity events: append-only (insert + read own; no update/delete policies)
GRANT SELECT, INSERT ON public.audiobook_activity_events TO authenticated;
GRANT ALL ON public.audiobook_activity_events TO service_role;
ALTER TABLE public.audiobook_activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audiobook_activity_events_owner_select ON public.audiobook_activity_events
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY audiobook_activity_events_owner_insert ON public.audiobook_activity_events
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- Storage policies: private, owner-folder-prefix scoped (mirrors product-files pattern)
CREATE POLICY audiobook_manuscripts_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audiobook-manuscripts' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY audiobook_manuscripts_owner_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audiobook-manuscripts' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY audiobook_manuscripts_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'audiobook-manuscripts' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY audiobook_manuscripts_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audiobook-manuscripts' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY audiobook_audio_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audiobook-audio' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY audiobook_audio_owner_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audiobook-audio' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY audiobook_audio_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'audiobook-audio' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY audiobook_audio_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audiobook-audio' AND (auth.uid())::text = (storage.foldername(name))[1]);