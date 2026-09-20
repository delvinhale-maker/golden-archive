-- Audiobook Studio Phase 1 security hardening: relational (cross-owner) ownership
-- enforcement, independent of the client-supplied owner_id RLS checks.
-- SECURITY INVOKER: parent lookups run under the caller's RLS, so a foreign
-- parent is invisible (NULL owner) AND the explicit owner comparison also fails
-- for RLS-bypassing service-role writes. Both paths are rejected.
CREATE OR REPLACE FUNCTION public.audiobook_enforce_owner_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  j jsonb := to_jsonb(NEW);
  refs text[][] := ARRAY[
    ARRAY['project_id','audiobook_projects'],
    ARRAY['source_id','audiobook_sources'],
    ARRAY['chapter_id','audiobook_chapters'],
    ARRAY['chapter_version_id','audiobook_chapter_versions'],
    ARRAY['voice_config_id','audiobook_voice_configs'],
    ARRAY['job_id','audiobook_generation_jobs'],
    ARRAY['qc_run_id','audiobook_qc_runs']
  ];
  i int;
  col text;
  tbl text;
  ref_id uuid;
  ref_owner uuid;
BEGIN
  IF NEW.owner_id IS NULL THEN
    RAISE EXCEPTION 'audiobook ownership violation: owner_id is required on %', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  FOR i IN 1..array_length(refs, 1) LOOP
    col := refs[i][1];
    tbl := refs[i][2];
    IF j ? col THEN
      ref_id := nullif(j->>col, '')::uuid;
      IF ref_id IS NOT NULL THEN
        EXECUTE format('SELECT owner_id FROM public.%I WHERE id = $1', tbl)
          INTO ref_owner USING ref_id;
        IF ref_owner IS NULL OR ref_owner <> NEW.owner_id THEN
          RAISE EXCEPTION 'audiobook ownership violation: %.% must reference a %s row owned by the same creator', TG_TABLE_NAME, col, tbl
            USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Marketplace product import: production ownership column is seller_id.
  IF j ? 'source_product_id' THEN
    ref_id := nullif(j->>'source_product_id', '')::uuid;
    IF ref_id IS NOT NULL THEN
      SELECT seller_id INTO ref_owner FROM public.marketplace_products WHERE id = ref_id;
      IF ref_owner IS NULL OR ref_owner <> NEW.owner_id THEN
        RAISE EXCEPTION 'audiobook ownership violation: source_product_id must reference a marketplace product owned by the same seller'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'audiobook_projects','audiobook_sources','audiobook_chapters','audiobook_chapter_versions',
  'audiobook_voice_configs','audiobook_pronunciations','audiobook_generation_jobs',
  'audiobook_audio_assets','audiobook_usage','audiobook_rights_attestations',
  'audiobook_activity_events','audiobook_qc_runs','audiobook_qc_results','audiobook_metadata'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audiobook_enforce_owner_consistency()',
      t || '_owner_consistency', t);
  END LOOP;
END $$;