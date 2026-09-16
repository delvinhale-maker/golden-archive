CREATE TABLE IF NOT EXISTS public.qr_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CONSTRAINT qr_campaigns_name_len CHECK (char_length(name) BETWEEN 1 AND 80),
  goal text,
  notes text,
  status text NOT NULL DEFAULT 'active' CONSTRAINT qr_campaigns_status_check CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qr_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_id text NOT NULL UNIQUE CONSTRAINT qr_projects_public_id_len CHECK (char_length(public_id) BETWEEN 16 AND 64),
  name text NOT NULL,
  mode text NOT NULL CONSTRAINT qr_projects_mode_check CHECK (mode IN ('static','dynamic')),
  destination_type text NOT NULL CONSTRAINT qr_projects_destination_type_check CHECK (destination_type IN ('url','email','tel','sms','text')),
  destination text NOT NULL,
  style jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CONSTRAINT qr_projects_status_check CHECK (status IN ('active','paused','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  use_case text CONSTRAINT qr_projects_use_case_len CHECK (use_case IS NULL OR char_length(use_case) BETWEEN 1 AND 40),
  niche text CONSTRAINT qr_projects_niche_len CHECK (niche IS NULL OR char_length(niche) BETWEEN 1 AND 40),
  placement_label text CONSTRAINT qr_projects_placement_label_len CHECK (placement_label IS NULL OR char_length(placement_label) BETWEEN 1 AND 80),
  campaign_id uuid REFERENCES public.qr_campaigns(id) ON DELETE SET NULL,
  duplicated_from uuid REFERENCES public.qr_projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.qr_scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_project_id uuid NOT NULL REFERENCES public.qr_projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  device_category text,
  referrer_host text
);

CREATE INDEX IF NOT EXISTS qr_campaigns_owner_idx ON public.qr_campaigns(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qr_projects_campaign_idx ON public.qr_projects(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS qr_projects_owner_active_dynamic_idx ON public.qr_projects(owner_user_id) WHERE mode='dynamic' AND status <> 'archived';
CREATE INDEX IF NOT EXISTS qr_projects_owner_idx ON public.qr_projects(owner_user_id);
CREATE INDEX IF NOT EXISTS qr_projects_public_id_idx ON public.qr_projects(public_id);
CREATE INDEX IF NOT EXISTS qr_scan_events_project_time_idx ON public.qr_scan_events(qr_project_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.qr_campaigns_guard_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN NEW; END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'QR campaign ownership cannot be reassigned';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.qr_projects_guard_campaign_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE campaign_owner uuid;
BEGIN
  IF NEW.campaign_id IS NULL THEN RETURN NEW; END IF;
  SELECT owner_user_id INTO campaign_owner FROM public.qr_campaigns WHERE id=NEW.campaign_id;
  IF campaign_owner IS NULL OR campaign_owner IS DISTINCT FROM NEW.owner_user_id THEN
    RAISE EXCEPTION 'A QR code can only be added to a campaign you own';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.qr_projects_guard_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN NEW; END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'QR project ownership cannot be reassigned';
  END IF;
  IF NEW.public_id IS DISTINCT FROM OLD.public_id THEN
    RAISE EXCEPTION 'QR public_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.qr_campaigns_guard_identity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.qr_projects_guard_campaign_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.qr_projects_guard_identity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS qr_campaigns_guard_identity_trg ON public.qr_campaigns;
CREATE TRIGGER qr_campaigns_guard_identity_trg BEFORE UPDATE ON public.qr_campaigns FOR EACH ROW EXECUTE FUNCTION public.qr_campaigns_guard_identity();
DROP TRIGGER IF EXISTS trg_qr_campaigns_updated ON public.qr_campaigns;
CREATE TRIGGER trg_qr_campaigns_updated BEFORE UPDATE ON public.qr_campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS qr_projects_guard_campaign_owner_trg ON public.qr_projects;
CREATE TRIGGER qr_projects_guard_campaign_owner_trg BEFORE INSERT OR UPDATE ON public.qr_projects FOR EACH ROW EXECUTE FUNCTION public.qr_projects_guard_campaign_owner();
DROP TRIGGER IF EXISTS qr_projects_guard_identity_trg ON public.qr_projects;
CREATE TRIGGER qr_projects_guard_identity_trg BEFORE UPDATE ON public.qr_projects FOR EACH ROW EXECUTE FUNCTION public.qr_projects_guard_identity();
DROP TRIGGER IF EXISTS trg_qr_projects_updated ON public.qr_projects;
CREATE TRIGGER trg_qr_projects_updated BEFORE UPDATE ON public.qr_projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.qr_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_scan_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.qr_campaigns,public.qr_projects,public.qr_scan_events FROM anon,authenticated;
GRANT ALL ON public.qr_campaigns,public.qr_projects,public.qr_scan_events TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.qr_campaigns,public.qr_projects TO authenticated;
GRANT SELECT ON public.qr_scan_events TO authenticated;

DROP POLICY IF EXISTS qr_campaigns_owner_read ON public.qr_campaigns;
CREATE POLICY qr_campaigns_owner_read ON public.qr_campaigns FOR SELECT TO authenticated USING (owner_user_id=(select auth.uid()));
DROP POLICY IF EXISTS qr_campaigns_owner_write ON public.qr_campaigns;
CREATE POLICY qr_campaigns_owner_write ON public.qr_campaigns FOR ALL TO authenticated USING (owner_user_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (owner_user_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role));

DROP POLICY IF EXISTS qr_projects_owner_read ON public.qr_projects;
CREATE POLICY qr_projects_owner_read ON public.qr_projects FOR SELECT TO authenticated USING (owner_user_id=(select auth.uid()));
DROP POLICY IF EXISTS qr_projects_owner_write ON public.qr_projects;
CREATE POLICY qr_projects_owner_write ON public.qr_projects FOR ALL TO authenticated USING (owner_user_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (owner_user_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role));

DROP POLICY IF EXISTS qr_scan_events_owner_read ON public.qr_scan_events;
CREATE POLICY qr_scan_events_owner_read ON public.qr_scan_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.qr_projects p WHERE p.id=qr_scan_events.qr_project_id AND (p.owner_user_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role))));