CREATE TYPE public.rights_snapshot_status AS ENUM ('ACTIVE', 'SUPERSEDED', 'REVOKED', 'ARCHIVED');

CREATE TABLE public.rights_passport_public_identities (
  passport_key UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rights_passport_public_identities_format CHECK (public_id ~ '^drp_[0-9a-f]{40}$')
);

CREATE INDEX rights_passport_public_identities_owner_idx ON public.rights_passport_public_identities (owner_user_id);

GRANT SELECT, INSERT ON public.rights_passport_public_identities TO authenticated;
GRANT ALL ON public.rights_passport_public_identities TO service_role;
REVOKE ALL ON public.rights_passport_public_identities FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_passport_public_identities FROM authenticated;

ALTER TABLE public.rights_passport_public_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rights_passport_public_identities_owner_read" ON public.rights_passport_public_identities
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_passport_public_identities_owner_insert" ON public.rights_passport_public_identities
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.rights_passport_public_identities_guard_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'A passport''s public_id is permanent and cannot be changed';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_passport_public_identities_guard_immutable() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rights_passport_public_identities_guard_immutable_trg
  BEFORE UPDATE ON public.rights_passport_public_identities
  FOR EACH ROW EXECUTE FUNCTION public.rights_passport_public_identities_guard_immutable();

CREATE TRIGGER rights_passport_public_identities_guard_passport_owner_trg
  BEFORE INSERT ON public.rights_passport_public_identities
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_passport_owner();

CREATE TABLE public.rights_passport_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_key UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_passport_id UUID NOT NULL REFERENCES public.rights_passports(id),
  public_id TEXT NOT NULL REFERENCES public.rights_passport_public_identities(public_id),

  passport_version INT NOT NULL,
  status public.rights_snapshot_status NOT NULL DEFAULT 'ACTIVE',
  schema_version TEXT NOT NULL DEFAULT '1.0',

  public_payload JSONB NOT NULL,
  private_snapshot_metadata JSONB,
  content_hash TEXT NOT NULL,
  supersedes_snapshot_id UUID REFERENCES public.rights_passport_snapshots(id),

  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_at DATE,
  revoked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rights_passport_snapshots_hash_format CHECK (content_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX rights_passport_snapshots_owner_idx ON public.rights_passport_snapshots (owner_user_id);
CREATE INDEX rights_passport_snapshots_key_idx ON public.rights_passport_snapshots (passport_key);
CREATE INDEX rights_passport_snapshots_public_id_idx ON public.rights_passport_snapshots (public_id);

CREATE UNIQUE INDEX rights_passport_snapshots_one_active_per_key
  ON public.rights_passport_snapshots (passport_key) WHERE status = 'ACTIVE';

GRANT SELECT, INSERT, UPDATE ON public.rights_passport_snapshots TO authenticated;
GRANT ALL ON public.rights_passport_snapshots TO service_role;
REVOKE ALL ON public.rights_passport_snapshots FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_passport_snapshots FROM authenticated;

ALTER TABLE public.rights_passport_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rights_passport_snapshots_owner_read" ON public.rights_passport_snapshots
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_passport_snapshots_owner_write" ON public.rights_passport_snapshots
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.rights_passport_snapshots_guard_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'Snapshot ownership cannot be reassigned';
  END IF;
  IF NEW.passport_key IS DISTINCT FROM OLD.passport_key THEN
    RAISE EXCEPTION 'Snapshot cannot be moved to a different passport';
  END IF;
  IF NEW.public_payload IS DISTINCT FROM OLD.public_payload THEN
    RAISE EXCEPTION 'A published snapshot''s public_payload is immutable';
  END IF;
  IF NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    RAISE EXCEPTION 'A published snapshot''s content_hash is immutable';
  END IF;
  IF NEW.passport_version IS DISTINCT FROM OLD.passport_version THEN
    RAISE EXCEPTION 'A published snapshot''s version is immutable';
  END IF;
  IF NEW.public_id IS DISTINCT FROM OLD.public_id THEN
    RAISE EXCEPTION 'A published snapshot''s public_id is immutable';
  END IF;
  IF NEW.source_passport_id IS DISTINCT FROM OLD.source_passport_id THEN
    RAISE EXCEPTION 'A published snapshot''s source is immutable';
  END IF;
  IF NEW.schema_version IS DISTINCT FROM OLD.schema_version THEN
    RAISE EXCEPTION 'A published snapshot''s schema_version is immutable';
  END IF;
  IF NEW.supersedes_snapshot_id IS DISTINCT FROM OLD.supersedes_snapshot_id THEN
    RAISE EXCEPTION 'A published snapshot''s supersedes_snapshot_id is immutable';
  END IF;
  IF NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'A published snapshot''s published_at is immutable';
  END IF;
  IF NEW.effective_at IS DISTINCT FROM OLD.effective_at THEN
    RAISE EXCEPTION 'A published snapshot''s effective_at is immutable';
  END IF;
  IF NEW.private_snapshot_metadata IS DISTINCT FROM OLD.private_snapshot_metadata THEN
    RAISE EXCEPTION 'A published snapshot''s private_snapshot_metadata is immutable';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rights_passport_snapshots_guard_immutable() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rights_passport_snapshots_guard_immutable_trg
  BEFORE UPDATE ON public.rights_passport_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.rights_passport_snapshots_guard_immutable();

CREATE TRIGGER rights_passport_snapshots_guard_passport_owner_trg
  BEFORE INSERT OR UPDATE OF passport_key, owner_user_id ON public.rights_passport_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_passport_owner();