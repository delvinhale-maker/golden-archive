ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS topic_interest text,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS consent_version text DEFAULT 'insider-v1',
  ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.subscribers
    ADD CONSTRAINT subscribers_audience_type_check
    CHECK (audience_type IN ('GENERAL','CREATOR','BUSINESS_TOOL'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS subscribers_audience_type_idx ON public.subscribers (audience_type);
CREATE INDEX IF NOT EXISTS subscribers_status_created_idx ON public.subscribers (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.insider_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subject text NOT NULL,
  preview_text text,
  body_md text NOT NULL DEFAULT '',
  audience_type text NOT NULL DEFAULT 'GENERAL',
  status text NOT NULL DEFAULT 'draft',
  is_public boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  sent_at timestamptz,
  recipients_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT insider_editions_status_check CHECK (status IN ('draft','published','sent')),
  CONSTRAINT insider_editions_audience_check CHECK (audience_type IN ('GENERAL','CREATOR','BUSINESS_TOOL'))
);

GRANT SELECT ON public.insider_editions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insider_editions TO authenticated;
GRANT ALL ON public.insider_editions TO service_role;

ALTER TABLE public.insider_editions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published public editions"
  ON public.insider_editions FOR SELECT TO anon, authenticated
  USING (is_public = true AND status IN ('published','sent'));

CREATE POLICY "Admins can read all editions"
  ON public.insider_editions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert editions"
  ON public.insider_editions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update editions"
  ON public.insider_editions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete editions"
  ON public.insider_editions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$ BEGIN NEW.updated_at = now(); RETURN NEW; END $fn$;

CREATE TRIGGER update_insider_editions_updated_at
  BEFORE UPDATE ON public.insider_editions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();