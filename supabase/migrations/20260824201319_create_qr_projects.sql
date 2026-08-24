-- AurumVault QR Business System — Phase 1 foundation schema.
--
-- qr_projects holds saved (dynamic-mode) QR codes only. Static QR is
-- generated on demand and never persisted (see src/lib/qr.functions.ts) —
-- that's a deliberate Phase 1 product decision, not an omission.
--
-- Security model: there is NO public SELECT policy on qr_projects. The
-- public /q/$publicId redirect never queries this table through an
-- RLS-bound client — it goes through a service-role lookup inside the
-- route's server handler (same pattern as getDeliveryFileDownload /
-- admin-seller-applications.functions.ts elsewhere in this codebase), so a
-- malicious anon/authenticated request can never read another owner's
-- project row, destination, or name. Owners see only their own rows via the
-- owner-scoped policy below.
CREATE TABLE public.qr_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('static', 'dynamic')),
  destination_type TEXT NOT NULL CHECK (destination_type IN ('url', 'email', 'tel', 'sms', 'text')),
  destination TEXT NOT NULL,
  style JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Phase 1 only ever creates 'dynamic' rows (static is unsaved-by-design),
  -- but the constraint stays permissive for both so a later "Save this
  -- static QR" feature (explicitly deferred, per the authorization) doesn't
  -- need a schema change to land.
  CONSTRAINT qr_projects_public_id_len CHECK (char_length(public_id) BETWEEN 16 AND 64)
);

CREATE INDEX qr_projects_owner_idx ON public.qr_projects (owner_user_id);
CREATE INDEX qr_projects_public_id_idx ON public.qr_projects (public_id);
-- Server-side active-dynamic-limit check (Section 15): count non-archived
-- dynamic rows for one owner. Partial index keeps that count cheap without
-- indexing archived history nobody queries by count.
CREATE INDEX qr_projects_owner_active_dynamic_idx ON public.qr_projects (owner_user_id)
  WHERE mode = 'dynamic' AND status <> 'archived';

GRANT SELECT, INSERT, UPDATE ON public.qr_projects TO authenticated;
GRANT ALL ON public.qr_projects TO service_role;

ALTER TABLE public.qr_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_projects_owner_read" ON public.qr_projects
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

CREATE POLICY "qr_projects_owner_write" ON public.qr_projects
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_qr_projects_updated
  BEFORE UPDATE ON public.qr_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Defense in depth, mirroring the admin-field guard trigger pattern used
-- elsewhere in this schema: even if application code ever added a
-- client-facing owner-write path, a
-- non-admin cannot reassign a project to another owner or hand-forge its
-- public_id (the redirect identifier must only ever come from
-- gen_random_uuid()-strength server generation, never client input).
CREATE OR REPLACE FUNCTION public.qr_projects_guard_identity()
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
    RAISE EXCEPTION 'QR project ownership cannot be reassigned';
  END IF;

  IF NEW.public_id IS DISTINCT FROM OLD.public_id THEN
    RAISE EXCEPTION 'QR public_id is immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER qr_projects_guard_identity_trg
  BEFORE UPDATE ON public.qr_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.qr_projects_guard_identity();

-- qr_scan_events — minimal, privacy-conscious scan log. No IP, no full
-- referrer URL, no fingerprinting, no geo. Insert path is service-role only
-- (the public redirect handler), never a direct anon/authenticated client
-- write — so there is no anon INSERT grant here at all, unlike
-- creator_storefront_events (which is legitimately anon-insertable because
-- its caller is the visitor's own browser, not a server redirect).
CREATE TABLE public.qr_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_project_id UUID NOT NULL REFERENCES public.qr_projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_category TEXT,
  referrer_host TEXT
);

CREATE INDEX qr_scan_events_project_time_idx
  ON public.qr_scan_events (qr_project_id, created_at DESC);

GRANT SELECT ON public.qr_scan_events TO authenticated;
GRANT ALL ON public.qr_scan_events TO service_role;

ALTER TABLE public.qr_scan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_scan_events_owner_read" ON public.qr_scan_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.qr_projects p
      WHERE p.id = qr_project_id
        AND (p.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );
