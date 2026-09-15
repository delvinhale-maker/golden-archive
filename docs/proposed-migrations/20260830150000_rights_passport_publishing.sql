-- AurumVault Digital Rights Passport Generator — Round 4: Generate, Verify,
-- Public Card & Export (immutable publishing model). STATUS: proposed /
-- unapplied. Staged here, not under supabase/migrations/, for the same
-- reason as every prior rights-passport migration: this platform's
-- migration runner applies anything under supabase/migrations/ immediately
-- against the shared preview+production database.
--
-- Nothing existing is altered: no DROP, no TRUNCATE, no DELETE, no ALTER of
-- any pre-existing table (Round 1/2/3/3.5 tables included).
--
-- WHY TWO NEW TABLES (SEARCH FIRST, per spec §D): Round 1's rights_passports
-- table holds the editable WORKSPACE row per version — it has no frozen
-- JSONB payload, and its fields remain mutable via updatePassport. A
-- published passport needs a genuinely immutable snapshot, which nothing
-- existing provides, so rights_passport_snapshots is new. Its public_id
-- must stay IDENTICAL across every republish in a lineage (so a printed QR
-- code never goes stale) while each snapshot ROW is version-specific — a
-- single UNIQUE public_id column on the snapshot table itself can't do
-- both at once (the 2nd version's insert would collide with the 1st's),
-- so the identifier lives in its own tiny one-row-per-lineage table,
-- rights_passport_public_identities, and every snapshot FKs to it.
--
-- SAFETY: public_payload is a frozen, hand-serialized representation
-- (built by serializePublicPassport() in rights-passport-serialize.ts, all
-- unit-tested to strip every private field) — never derived dynamically
-- from current workspace state when read back. Only `status` and
-- `revoked_at` may ever change on an existing snapshot row; everything
-- else, including public_payload and content_hash, is guarded immutable
-- below.

CREATE TYPE public.rights_snapshot_status AS ENUM ('ACTIVE', 'SUPERSEDED', 'REVOKED', 'ARCHIVED');

-- ==========================================================================
-- rights_passport_public_identities — one stable, opaque public_id per
-- passport_key lineage. Never updated once created (guard trigger below).
-- ==========================================================================
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

-- Owner-only read (the PUBLIC /rights/$publicId route never queries this
-- table directly — it goes through a server function using the service-role
-- client, exactly like every other "public-facing but privacy-sensitive"
-- read elsewhere in this codebase). No anon policy exists here at all.
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

-- A public_id, once minted, must resolve to exactly one passport_key —
-- the guard trigger above already blocks changing it, and the ownership
-- guard below (reused from Round 2/3) blocks minting one for a passport_key
-- the caller doesn't own; this trigger additionally verifies the
-- passport_key the caller is claiming an identity for actually belongs to
-- them (defense in depth alongside the RLS INSERT policy above).
CREATE TRIGGER rights_passport_public_identities_guard_passport_owner_trg
  BEFORE INSERT ON public.rights_passport_public_identities
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_passport_owner();

-- ==========================================================================
-- rights_passport_snapshots — immutable published payloads. One row per
-- publish event; supersedes_snapshot_id chains a lineage's history.
-- ==========================================================================
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

-- At most one ACTIVE snapshot per passport_key lineage — publishing a new
-- version must supersede the old one in the same transaction, never leave
-- two simultaneously ACTIVE.
CREATE UNIQUE INDEX rights_passport_snapshots_one_active_per_key
  ON public.rights_passport_snapshots (passport_key) WHERE status = 'ACTIVE';

GRANT SELECT, INSERT, UPDATE ON public.rights_passport_snapshots TO authenticated;
GRANT ALL ON public.rights_passport_snapshots TO service_role;
REVOKE ALL ON public.rights_passport_snapshots FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_passport_snapshots FROM authenticated;

ALTER TABLE public.rights_passport_snapshots ENABLE ROW LEVEL SECURITY;

-- Owner-only. The PUBLIC card route reads via a server function on the
-- service-role client (bypassing RLS by design, exactly like every other
-- public-but-sensitive read in this codebase — see e.g. validateStoredManuscript's
-- use of supabaseAdmin), which selects ONLY public_payload-derived fields
-- for an ACTIVE row and never anything else. No anon policy exists on this
-- table at all, so a direct anonymous query against it (bypassing the
-- server function) returns nothing.
CREATE POLICY "rights_passport_snapshots_owner_read" ON public.rights_passport_snapshots
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_passport_snapshots_owner_write" ON public.rights_passport_snapshots
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- IMMUTABILITY: once created, only status/revoked_at may ever change.
-- public_payload, content_hash, passport_version, schema_version,
-- public_id, passport_key, owner_user_id, source_passport_id, and
-- published_at/effective_at are all permanent — this is what makes a
-- published snapshot a genuine historical record rather than a mutable
-- cache (spec §D: "Do not derive historical public versions dynamically...
-- that would corrupt history").
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

-- Reused as-is from Round 2/3 (public.rights_workspace_guard_passport_owner)
-- — a snapshot can only ever be attached to a passport_key the caller owns.
CREATE TRIGGER rights_passport_snapshots_guard_passport_owner_trg
  BEFORE INSERT OR UPDATE OF passport_key, owner_user_id ON public.rights_passport_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.rights_workspace_guard_passport_owner();
