-- AurumVault QR Business System — Phase 2: outcome metadata + campaigns.
--
-- Purely additive. No existing qr_projects row is touched by this
-- migration (every new column is NULL-default), and Phase 1's identifiers,
-- ownership model, and RLS remain untouched.
--
-- IMPORTANT: per the Phase 2 authorization, this migration is written for
-- review only and must NOT be applied yet — Lovable preview and production
-- share the same backend, so applying it requires separate authorization.

ALTER TABLE public.qr_projects
  ADD COLUMN use_case TEXT NULL,
  ADD COLUMN niche TEXT NULL,
  ADD COLUMN placement_label TEXT NULL;

-- qr_campaigns — lightweight grouping for multiple QR projects (e.g. "Open
-- House — 123 Main Street" grouping a Front Door / Flyer / Instagram QR).
-- Same owner-scoped-only security model as qr_projects: no public SELECT at
-- all, since a campaign name/niche is the owner's own business information.
CREATE TABLE public.qr_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  niche TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qr_campaigns_name_len CHECK (char_length(name) BETWEEN 1 AND 80)
);

CREATE INDEX qr_campaigns_owner_idx ON public.qr_campaigns (owner_user_id);

GRANT SELECT, INSERT, UPDATE ON public.qr_campaigns TO authenticated;
GRANT ALL ON public.qr_campaigns TO service_role;
REVOKE ALL ON public.qr_campaigns FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.qr_campaigns FROM authenticated;

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

-- Same defense-in-depth ownership-immutability guard used by
-- qr_projects_guard_identity() — a non-admin cannot reassign a campaign to
-- another owner even if a future client-facing write path forgot to scope
-- by owner_user_id.
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

REVOKE EXECUTE ON FUNCTION public.qr_campaigns_guard_identity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.qr_campaigns_guard_identity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.qr_campaigns_guard_identity() FROM authenticated;

CREATE TRIGGER qr_campaigns_guard_identity_trg
  BEFORE UPDATE ON public.qr_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.qr_campaigns_guard_identity();

-- qr_projects.campaign_id — nullable FK, ON DELETE SET NULL so deleting (or
-- rather archiving, since campaigns have no delete path yet) a campaign
-- never cascades into destroying a QR project or its scan history.
ALTER TABLE public.qr_projects
  ADD COLUMN campaign_id UUID NULL REFERENCES public.qr_campaigns(id) ON DELETE SET NULL;

CREATE INDEX qr_projects_campaign_idx ON public.qr_projects (campaign_id) WHERE campaign_id IS NOT NULL;

-- Defense in depth for Phase 2 §10/§23: a plain FK doesn't know that
-- qr_projects.owner_user_id must match qr_campaigns.owner_user_id — RLS on
-- qr_projects alone can't see across tables. Without this, an owner could
-- (accidentally or via a bug in application code) attach their own QR
-- project to another user's campaign_id, or vice versa. This trigger makes
-- that impossible at the database layer regardless of what the server
-- function does, matching qr_projects_guard_identity()'s "never trust a
-- single layer" posture.
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
  FROM public.qr_campaigns
  WHERE id = NEW.campaign_id;

  IF campaign_owner IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF campaign_owner IS DISTINCT FROM NEW.owner_user_id THEN
    RAISE EXCEPTION 'A QR project can only be attached to a campaign you own';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.qr_projects_guard_campaign_owner() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.qr_projects_guard_campaign_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.qr_projects_guard_campaign_owner() FROM authenticated;

CREATE TRIGGER qr_projects_guard_campaign_owner_trg
  BEFORE INSERT OR UPDATE OF campaign_id ON public.qr_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.qr_projects_guard_campaign_owner();
