-- AurumVault QR Business System — Phase 2 (additive).
--
-- Adds campaign grouping, placement tracking, business-goal / industry-kit
-- provenance, and duplication lineage on top of the Phase 1 foundation.
-- Nothing in Phase 1 is altered or dropped: every new column is nullable
-- and every new policy is owner-scoped, matching qr_projects exactly.

CREATE TABLE public.qr_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qr_campaigns_name_len CHECK (char_length(name) BETWEEN 1 AND 80)
);

CREATE INDEX qr_campaigns_owner_idx ON public.qr_campaigns (owner_user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.qr_campaigns TO authenticated;
GRANT ALL ON public.qr_campaigns TO service_role;

ALTER TABLE public.qr_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_campaigns_owner_read" ON public.qr_campaigns
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

CREATE POLICY "qr_campaigns_owner_write" ON public.qr_campaigns
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_qr_campaigns_updated
  BEFORE UPDATE ON public.qr_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Same defense-in-depth guard as qr_projects: a non-admin can never
-- reassign a campaign to another owner.
CREATE OR REPLACE FUNCTION public.qr_campaigns_guard_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'QR campaign ownership cannot be reassigned';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER qr_campaigns_guard_identity_trg
  BEFORE UPDATE ON public.qr_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.qr_campaigns_guard_identity();

-- Phase 2 columns on qr_projects. All nullable — existing Phase 1 rows stay
-- valid untouched.
ALTER TABLE public.qr_projects
  ADD COLUMN use_case TEXT,
  ADD COLUMN niche TEXT,
  ADD COLUMN placement_label TEXT,
  ADD COLUMN campaign_id UUID REFERENCES public.qr_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN duplicated_from UUID REFERENCES public.qr_projects(id) ON DELETE SET NULL;

ALTER TABLE public.qr_projects
  ADD CONSTRAINT qr_projects_placement_label_len
    CHECK (placement_label IS NULL OR char_length(placement_label) BETWEEN 1 AND 80),
  ADD CONSTRAINT qr_projects_use_case_len
    CHECK (use_case IS NULL OR char_length(use_case) BETWEEN 1 AND 40),
  ADD CONSTRAINT qr_projects_niche_len
    CHECK (niche IS NULL OR char_length(niche) BETWEEN 1 AND 40);

CREATE INDEX qr_projects_campaign_idx ON public.qr_projects (campaign_id)
  WHERE campaign_id IS NOT NULL;

-- A campaign may only ever hold QR codes owned by the same person. Enforced
-- in the database as well as in the server functions, so a campaign can
-- never become a cross-owner data-leak surface.
CREATE OR REPLACE FUNCTION public.qr_projects_guard_campaign_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  campaign_owner UUID;
BEGIN
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT owner_user_id INTO campaign_owner
  FROM public.qr_campaigns WHERE id = NEW.campaign_id;

  IF campaign_owner IS NULL OR campaign_owner IS DISTINCT FROM NEW.owner_user_id THEN
    RAISE EXCEPTION 'A QR code can only be added to a campaign you own';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER qr_projects_guard_campaign_owner_trg
  BEFORE INSERT OR UPDATE ON public.qr_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.qr_projects_guard_campaign_owner();