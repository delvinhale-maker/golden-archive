-- Founding 100 cohort registry
CREATE TABLE public.founding_creators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  founding_number integer NOT NULL UNIQUE CHECK (founding_number BETWEEN 1 AND 100),
  seller_application_id uuid REFERENCES public.seller_applications(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.creator_leads(id) ON DELETE SET NULL,
  campaign_source text,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Public badge data only: number + user + acceptance date. Never lead/campaign/admin.
GRANT SELECT (user_id, founding_number, accepted_at) ON public.founding_creators TO anon, authenticated;
GRANT ALL ON public.founding_creators TO service_role;
ALTER TABLE public.founding_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founding cohort is publicly visible"
  ON public.founding_creators FOR SELECT TO anon, authenticated USING (true);

-- Server-assigned only: transactional, gap-free, capped at 100, idempotent.
CREATE OR REPLACE FUNCTION public.assign_founding_creator(
  _user_id uuid,
  _application_id uuid DEFAULT NULL,
  _lead_id uuid DEFAULT NULL,
  _campaign_source text DEFAULT NULL,
  _accepted_by uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing integer;
  _next integer;
BEGIN
  SELECT founding_number INTO _existing FROM public.founding_creators WHERE user_id = _user_id;
  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('founding_creators_assign'));

  SELECT COALESCE(MAX(founding_number), 0) + 1 INTO _next FROM public.founding_creators;
  IF _next > 100 THEN
    RAISE EXCEPTION 'Founding 100 cohort is full';
  END IF;

  INSERT INTO public.founding_creators
    (user_id, founding_number, seller_application_id, lead_id, campaign_source, accepted_by)
  VALUES (_user_id, _next, _application_id, _lead_id, _campaign_source, _accepted_by);

  RETURN _next;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_founding_creator(uuid, uuid, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_founding_creator(uuid, uuid, uuid, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_founding_creator(uuid, uuid, uuid, text, uuid) TO service_role;

-- Campaign attribution on the existing creator application
ALTER TABLE public.seller_applications
  ADD COLUMN IF NOT EXISTS campaign text,
  ADD COLUMN IF NOT EXISTS campaign_source text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS referring_url text,
  ADD COLUMN IF NOT EXISTS creator_lead_id uuid REFERENCES public.creator_leads(id) ON DELETE SET NULL;

-- Outreach tracker (admin only)
CREATE TABLE public.creator_prospects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  platform text,
  profile_url text,
  contact_email text,
  niche text,
  audience_size integer,
  status text NOT NULL DEFAULT 'identified'
    CHECK (status IN ('identified','contacted','replied','applied','approved','declined','not_a_fit')),
  notes text,
  last_contacted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_prospects TO authenticated;
GRANT ALL ON public.creator_prospects TO service_role;
ALTER TABLE public.creator_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage creator prospects"
  ON public.creator_prospects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER creator_prospects_touch
  BEFORE UPDATE ON public.creator_prospects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Creator activation milestones (server-written, derived from real records)
CREATE TABLE public.creator_activation (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_at timestamptz,
  profile_completed_at timestamptz,
  first_product_started_at timestamptz,
  first_product_submitted_at timestamptz,
  first_product_approved_at timestamptz,
  first_product_published_at timestamptz,
  first_sale_at timestamptz,
  nudge_profile_sent_at timestamptz,
  nudge_first_product_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.creator_activation TO authenticated;
GRANT ALL ON public.creator_activation TO service_role;
ALTER TABLE public.creator_activation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators read own activation"
  ON public.creator_activation FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER creator_activation_touch
  BEFORE UPDATE ON public.creator_activation
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();