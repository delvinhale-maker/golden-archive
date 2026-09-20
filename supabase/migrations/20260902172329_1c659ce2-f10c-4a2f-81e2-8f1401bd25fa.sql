-- Business Certificate & License Wallet — additive, owner-scoped schema.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. Entitlements (plan boundary; no billing rows are written by clients)
CREATE TABLE public.license_wallet_entitlements (
  user_id uuid PRIMARY KEY,
  plan text NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE','SOLO','BUSINESS','MULTI_LOCATION')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','canceled','past_due')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.license_wallet_entitlements TO authenticated;
GRANT ALL ON public.license_wallet_entitlements TO service_role;
ALTER TABLE public.license_wallet_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_ent_select_own" ON public.license_wallet_entitlements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_wallet_ent_updated BEFORE UPDATE ON public.license_wallet_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Locations
CREATE TABLE public.license_wallet_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_locations_owner ON public.license_wallet_locations(owner_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_wallet_locations TO authenticated;
GRANT ALL ON public.license_wallet_locations TO service_role;
ALTER TABLE public.license_wallet_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_locations_own" ON public.license_wallet_locations
  FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE TRIGGER trg_wallet_locations_updated BEFORE UPDATE ON public.license_wallet_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Documents
CREATE TABLE public.license_wallet_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'INSURANCE_CERTIFICATE','BUSINESS_LICENSE','PROFESSIONAL_LICENSE','PERMIT',
    'DBA_ASSUMED_NAME','REGISTRATION','CERTIFICATE','INSPECTION_RECORD','OTHER'
  )),
  issuer text,
  doc_number text,
  issue_date date,
  expiration_date date,
  no_expiration boolean NOT NULL DEFAULT false,
  location_id uuid REFERENCES public.license_wallet_locations(id) ON DELETE SET NULL,
  notes text,
  file_path text,
  file_name text,
  file_mime text,
  file_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_docs_owner ON public.license_wallet_documents(owner_user_id);
CREATE INDEX idx_wallet_docs_expiry ON public.license_wallet_documents(expiration_date)
  WHERE no_expiration = false;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_wallet_documents TO authenticated;
GRANT ALL ON public.license_wallet_documents TO service_role;
ALTER TABLE public.license_wallet_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_docs_own" ON public.license_wallet_documents
  FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE TRIGGER trg_wallet_docs_updated BEFORE UPDATE ON public.license_wallet_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Relational ownership guard: a document may only reference the owner's own location.
CREATE OR REPLACE FUNCTION public.license_wallet_enforce_owner_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  loc_owner uuid;
BEGIN
  IF NEW.location_id IS NOT NULL THEN
    SELECT owner_user_id INTO loc_owner FROM public.license_wallet_locations WHERE id = NEW.location_id;
    IF loc_owner IS NULL OR loc_owner <> NEW.owner_user_id THEN
      RAISE EXCEPTION 'Location does not belong to this owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_wallet_docs_owner_consistency
  BEFORE INSERT OR UPDATE ON public.license_wallet_documents
  FOR EACH ROW EXECUTE FUNCTION public.license_wallet_enforce_owner_consistency();

-- 4. Reminder settings
CREATE TABLE public.license_wallet_reminder_settings (
  owner_user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  recipient_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_wallet_reminder_settings TO authenticated;
GRANT ALL ON public.license_wallet_reminder_settings TO service_role;
ALTER TABLE public.license_wallet_reminder_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_reminder_settings_own" ON public.license_wallet_reminder_settings
  FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE TRIGGER trg_wallet_reminder_settings_updated BEFORE UPDATE ON public.license_wallet_reminder_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Reminder log (idempotency)
CREATE TABLE public.license_wallet_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES public.license_wallet_documents(id) ON DELETE CASCADE,
  offset_days integer NOT NULL,
  reminder_for_date date NOT NULL,
  recipient_email text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, offset_days, reminder_for_date)
);
CREATE INDEX idx_wallet_reminder_log_owner ON public.license_wallet_reminder_log(owner_user_id);
GRANT SELECT ON public.license_wallet_reminder_log TO authenticated;
GRANT ALL ON public.license_wallet_reminder_log TO service_role;
ALTER TABLE public.license_wallet_reminder_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_reminder_log_select_own" ON public.license_wallet_reminder_log
  FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);

-- 6. Activity history
CREATE TABLE public.license_wallet_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  document_id uuid REFERENCES public.license_wallet_documents(id) ON DELETE SET NULL,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_activity_owner ON public.license_wallet_activity(owner_user_id, created_at DESC);
GRANT SELECT, INSERT ON public.license_wallet_activity TO authenticated;
GRANT ALL ON public.license_wallet_activity TO service_role;
ALTER TABLE public.license_wallet_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_activity_select_own" ON public.license_wallet_activity
  FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "wallet_activity_insert_own" ON public.license_wallet_activity
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);

-- 7. Private storage policies — owner-prefixed paths only, no public access.
CREATE POLICY "wallet_files_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'license-wallet-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wallet_files_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'license-wallet-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wallet_files_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'license-wallet-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'license-wallet-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wallet_files_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'license-wallet-documents' AND (storage.foldername(name))[1] = auth.uid()::text);