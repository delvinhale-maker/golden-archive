CREATE TYPE public.rights_passport_plan AS ENUM (
  'FREE_PREVIEW', 'PERSONAL', 'PROFESSIONAL', 'BUSINESS'
);

CREATE TABLE public.rights_passport_entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.rights_passport_plan NOT NULL DEFAULT 'FREE_PREVIEW',
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

CREATE POLICY "rights_passport_entitlements_owner_read" ON public.rights_passport_entitlements
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rights_passport_entitlements_updated
  BEFORE UPDATE ON public.rights_passport_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();