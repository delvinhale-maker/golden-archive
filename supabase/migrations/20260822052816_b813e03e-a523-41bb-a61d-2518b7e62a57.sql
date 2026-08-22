-- Extend creator_leads for the Creator Starter Pack funnel (additive only)
ALTER TABLE public.creator_leads
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS normalized_email text,
  ADD COLUMN IF NOT EXISTS acquisition_type text NOT NULL DEFAULT 'CREATOR_LEAD',
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS referring_url text,
  ADD COLUMN IF NOT EXISTS landing_page text,
  ADD COLUMN IF NOT EXISTS starter_pack_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS starter_pack_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS starter_pack_send_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_send_status text,
  ADD COLUMN IF NOT EXISTS nurture_step2_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS nurture_step3_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS nurture_step4_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS nurture_step5_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_application_id uuid REFERENCES public.seller_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS application_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_to_creator_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_status text NOT NULL DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill normalized email for existing rows
UPDATE public.creator_leads
   SET normalized_email = lower(btrim(email))
 WHERE normalized_email IS NULL;

-- Keep normalized_email always in sync with email
CREATE OR REPLACE FUNCTION public.creator_leads_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.normalized_email := lower(btrim(NEW.email));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_leads_normalize_trg ON public.creator_leads;
CREATE TRIGGER creator_leads_normalize_trg
BEFORE INSERT OR UPDATE ON public.creator_leads
FOR EACH ROW EXECUTE FUNCTION public.creator_leads_normalize();

-- One lead record per address: dedupe first, keeping the earliest row
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY lower(btrim(email)) ORDER BY created_at) AS rn
    FROM public.creator_leads
)
DELETE FROM public.creator_leads cl
 USING ranked r
 WHERE cl.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS creator_leads_normalized_email_key
  ON public.creator_leads (normalized_email);

CREATE INDEX IF NOT EXISTS creator_leads_acquisition_idx
  ON public.creator_leads (acquisition_type, created_at DESC);
CREATE INDEX IF NOT EXISTS creator_leads_nurture_idx
  ON public.creator_leads (marketing_consent, starter_pack_requested_at);

-- Link a new seller application back to its acquisition lead (no data duplication)
CREATE OR REPLACE FUNCTION public.creator_leads_link_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  _email := lower(btrim(coalesce(NEW.applicant_email, '')));
  IF _email = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.creator_leads
     SET seller_application_id = NEW.id,
         application_submitted_at = coalesce(application_submitted_at, NEW.created_at),
         converted_to_creator_at = CASE
           WHEN NEW.status = 'approved' THEN coalesce(converted_to_creator_at, now())
           ELSE converted_to_creator_at END,
         lead_status = CASE
           WHEN NEW.status = 'approved' THEN 'CREATOR_ACTIVE'
           ELSE 'APPLICATION_SUBMITTED' END
   WHERE normalized_email = _email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_leads_link_application_trg ON public.seller_applications;
CREATE TRIGGER creator_leads_link_application_trg
AFTER INSERT OR UPDATE OF status ON public.seller_applications
FOR EACH ROW EXECUTE FUNCTION public.creator_leads_link_application();

-- Access stays insert-only for anonymous visitors; admin reads use service role.
GRANT INSERT ON public.creator_leads TO anon;
GRANT INSERT ON public.creator_leads TO authenticated;
GRANT ALL ON public.creator_leads TO service_role;