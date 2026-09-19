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