CREATE TYPE public.rights_passport_status AS ENUM (
  'DRAFT', 'ACTIVE', 'SUPERSEDED', 'REVOKED', 'ARCHIVED'
);

CREATE TYPE public.rights_verification_level AS ENUM (
  'SELF_DECLARED', 'DOCUMENT_SUPPORTED', 'REPRESENTATIVE_VERIFIED', 'THIRD_PARTY_VERIFIED'
);

CREATE TYPE public.rights_asset_type AS ENUM (
  'NAME', 'STAGE_NAME', 'LIKENESS_IMAGE', 'VOICE', 'SIGNATURE', 'MOVEMENT_MANNERISM',
  'BIOGRAPHY', 'SOCIAL_HANDLE', 'CREATIVE_WORK', 'MUSIC', 'BOOK_WRITING', 'VIDEO_FILM',
  'PHOTOGRAPH', 'ARTWORK_DESIGN', 'CHARACTER', 'TRADEMARK_MARK', 'LOGO',
  'COURSE_TRAINING', 'PODCAST_MEDIA', 'DIGITAL_PRODUCT', 'DATASET_ARCHIVE', 'OTHER'
);

CREATE TYPE public.rights_control_basis AS ENUM (
  'CREATORSHIP', 'CONTRACT', 'ASSIGNMENT', 'LICENSE', 'TRADEMARK',
  'PUBLICITY_PERSONALITY_RIGHT', 'ENTITY_OWNERSHIP', 'REPRESENTATIVE_AUTHORITY',
  'OTHER', 'REVIEW_REQUIRED'
);

CREATE TYPE public.rights_asset_status AS ENUM (
  'ACTIVE', 'DISPUTED', 'REVIEW_REQUIRED', 'ARCHIVED'
);

CREATE TYPE public.rights_ai_policy AS ENUM (
  'ALLOW', 'ALLOW_WITH_TERMS', 'PROHIBIT', 'CASE_BY_CASE', 'CONTACT_FOR_LICENSE', 'REVIEW_REQUIRED'
);

CREATE TABLE public.rights_passports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_key UUID NOT NULL DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id UUID NULL REFERENCES public.rights_passports(id) ON DELETE SET NULL,
  status public.rights_passport_status NOT NULL DEFAULT 'DRAFT',

  public_professional_name TEXT,
  legal_name TEXT,
  stage_brand_name TEXT,
  primary_role TEXT,
  jurisdiction TEXT,
  rights_contact_email TEXT,
  rights_entity TEXT,
  public_rights_url TEXT,
  verification_level public.rights_verification_level NOT NULL DEFAULT 'SELF_DECLARED',
  representative_name TEXT,
  representative_contact TEXT,
  agent_manager_name TEXT,
  agent_manager_contact TEXT,
  successor_estate_contact TEXT,
  effective_date DATE,
  review_frequency TEXT,
  public_notes TEXT,
  private_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rights_passports_version_positive CHECK (version >= 1)
);

CREATE INDEX rights_passports_owner_idx ON public.rights_passports (owner_user_id);
CREATE INDEX rights_passports_key_idx ON public.rights_passports (passport_key);
CREATE UNIQUE INDEX rights_passports_one_active_per_key
  ON public.rights_passports (passport_key)
  WHERE status = 'ACTIVE';

GRANT SELECT, INSERT, UPDATE ON public.rights_passports TO authenticated;
GRANT ALL ON public.rights_passports TO service_role;
REVOKE ALL ON public.rights_passports FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_passports FROM authenticated;

ALTER TABLE public.rights_passports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rights_passports_owner_read" ON public.rights_passports
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_passports_owner_write" ON public.rights_passports
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rights_passports_updated
  BEFORE UPDATE ON public.rights_passports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.rights_passports_guard_identity()
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
    RAISE EXCEPTION 'Rights passport ownership cannot be reassigned';
  END IF;

  IF NEW.passport_key IS DISTINCT FROM OLD.passport_key THEN
    RAISE EXCEPTION 'Rights passport lineage key is immutable';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rights_passports_guard_identity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rights_passports_guard_identity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rights_passports_guard_identity() FROM authenticated;

CREATE TRIGGER rights_passports_guard_identity_trg
  BEFORE UPDATE ON public.rights_passports
  FOR EACH ROW
  EXECUTE FUNCTION public.rights_passports_guard_identity();

CREATE TABLE public.rights_passport_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_key UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  asset_type public.rights_asset_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  claimed_owner_controller TEXT,
  control_basis public.rights_control_basis NOT NULL DEFAULT 'REVIEW_REQUIRED',
  registration_identifier TEXT,
  evidence_location TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  default_ai_policy public.rights_ai_policy NOT NULL DEFAULT 'REVIEW_REQUIRED',
  default_license_policy TEXT,
  territory TEXT,
  expiry_date DATE,
  representative TEXT,
  status public.rights_asset_status NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rights_passport_assets_name_len CHECK (char_length(name) BETWEEN 1 AND 200)
);

CREATE INDEX rights_passport_assets_owner_idx ON public.rights_passport_assets (owner_user_id);
CREATE INDEX rights_passport_assets_key_idx ON public.rights_passport_assets (passport_key);

GRANT SELECT, INSERT, UPDATE ON public.rights_passport_assets TO authenticated;
GRANT ALL ON public.rights_passport_assets TO service_role;
REVOKE ALL ON public.rights_passport_assets FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.rights_passport_assets FROM authenticated;

ALTER TABLE public.rights_passport_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rights_passport_assets_owner_read" ON public.rights_passport_assets
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rights_passport_assets_owner_write" ON public.rights_passport_assets
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rights_passport_assets_updated
  BEFORE UPDATE ON public.rights_passport_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.rights_passport_assets_guard_identity()
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
    RAISE EXCEPTION 'Rights passport asset ownership cannot be reassigned';
  END IF;

  IF NEW.passport_key IS DISTINCT FROM OLD.passport_key THEN
    RAISE EXCEPTION 'Rights passport asset cannot be moved to a different passport';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rights_passport_assets_guard_identity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rights_passport_assets_guard_identity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rights_passport_assets_guard_identity() FROM authenticated;

CREATE TRIGGER rights_passport_assets_guard_identity_trg
  BEFORE UPDATE ON public.rights_passport_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.rights_passport_assets_guard_identity();

CREATE OR REPLACE FUNCTION public.rights_passport_assets_guard_passport_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  passport_owner UUID;
BEGIN
  SELECT owner_user_id INTO passport_owner
  FROM public.rights_passports
  WHERE passport_key = NEW.passport_key
  LIMIT 1;

  IF passport_owner IS NULL THEN
    RAISE EXCEPTION 'Passport not found';
  END IF;

  IF passport_owner IS DISTINCT FROM NEW.owner_user_id THEN
    RAISE EXCEPTION 'An asset can only be attached to a passport you own';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rights_passport_assets_guard_passport_owner() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rights_passport_assets_guard_passport_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rights_passport_assets_guard_passport_owner() FROM authenticated;

CREATE TRIGGER rights_passport_assets_guard_passport_owner_trg
  BEFORE INSERT OR UPDATE OF passport_key, owner_user_id ON public.rights_passport_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.rights_passport_assets_guard_passport_owner();