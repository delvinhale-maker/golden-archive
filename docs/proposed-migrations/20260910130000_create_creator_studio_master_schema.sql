-- ============================================================================
-- AurumVault Creator Studio(tm) -- CS1-CS5 master schema
-- ============================================================================
-- STATUS: PROPOSED / NOT APPLIED.
--
-- This file lives under docs/proposed-migrations/, which this repository
-- treats as a staging area for hand-authored migrations that have NOT been
-- run against any Supabase project (the platform's migration runner only
-- applies files under supabase/migrations/, using Lovable-generated UUID
-- filenames). Applying this file to staging or production is a deliberate,
-- separate, human-approved step outside this branch's implementation work.
--
-- Additive only: every statement here creates new objects. Nothing alters,
-- drops, or loosens any existing table, policy, or RLS setting.
--
-- Reused from confirmed-applied migrations (never redefined here):
--   - public.has_role(_user_id uuid, _role public.app_role) -- admin check
--   - public.touch_updated_at()                              -- updated_at trigger
--   - public.app_role enum ('admin','seller','buyer')
--
-- No entitlement/subscription system exists anywhere else in this codebase
-- (independently verified on this branch: no `entitlement` hits in
-- supabase/migrations/ or src/, and every Stripe checkout in
-- src/lib/payments.functions.ts uses mode:"payment" -- there is no
-- mode:"subscription" usage anywhere). This migration is therefore the
-- FIRST entitlement/plan system in this repository, not an extension of a
-- pre-existing one -- see docs/creator-studio/entitlements.md for the
-- decision record.
--
-- Design notes:
--   - Enums are modeled as TEXT + CHECK rather than native Postgres ENUM
--     types, matching this repository's established Creator Studio
--     convention (see the CS1-foundation draft on the sibling
--     creator-studio/cs1-foundation branch): adding a value later is a
--     cheap ALTER TABLE ... DROP/ADD CONSTRAINT, not a transaction-
--     restricted ALTER TYPE ... ADD VALUE.
--   - aspect_ratio is CHECK'd to '9:16' only for V1, isolated on its own
--     constraint so CS2+ can widen it (e.g. add '1:1', '16:9') without
--     touching any other column or replacing the table.
--   - All entitlement-affecting writes go through SECURITY DEFINER RPCs
--     (creator_studio_reserve_video_credit / _finalize_consumption /
--     _release_reservation / _apply_stripe_fulfillment). No table grants
--     let `authenticated` mutate its own entitlements or ledger rows
--     directly -- server-side enforcement only, per the CS4/CS5 security
--     requirements ("never rely on client-side counters").
--
-- Rollback (manual, staging only):
--   DROP FUNCTION IF EXISTS public.creator_studio_apply_stripe_fulfillment(uuid,text,text,timestamptz,integer,integer,text,text);
--   DROP FUNCTION IF EXISTS public.creator_studio_release_reservation(uuid,text);
--   DROP FUNCTION IF EXISTS public.creator_studio_finalize_consumption(uuid,text);
--   DROP FUNCTION IF EXISTS public.creator_studio_reserve_video_credit(uuid,uuid,text);
--   DROP FUNCTION IF EXISTS public.guard_creator_studio_owner();
--   DROP TABLE IF EXISTS public.creator_studio_usage_ledger CASCADE;
--   DROP TABLE IF EXISTS public.creator_studio_provider_events CASCADE;
--   DROP TABLE IF EXISTS public.creator_studio_render_jobs CASCADE;
--   DROP TABLE IF EXISTS public.creator_studio_project_assets CASCADE;
--   DROP TABLE IF EXISTS public.creator_studio_assets CASCADE;
--   DROP TABLE IF EXISTS public.creator_studio_projects CASCADE;
--   DROP TABLE IF EXISTS public.creator_studio_entitlements CASCADE;
--   DELETE FROM storage.objects WHERE bucket_id IN ('creator-studio-source-assets','creator-studio-renders');
--   DELETE FROM storage.buckets WHERE id IN ('creator-studio-source-assets','creator-studio-renders');
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. creator_studio_entitlements -- one row per user, plan + quota state.
-- ----------------------------------------------------------------------------
CREATE TABLE public.creator_studio_entitlements (
  user_id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                         TEXT NOT NULL DEFAULT 'FREE'
                                 CHECK (plan IN ('FREE','CREATOR_PRO','CREATOR_BUSINESS')),
  videos_included_per_period   INTEGER NOT NULL DEFAULT 0 CHECK (videos_included_per_period >= 0),
  videos_used_this_period      INTEGER NOT NULL DEFAULT 0 CHECK (videos_used_this_period >= 0),
  free_preview_used            BOOLEAN NOT NULL DEFAULT false,
  extra_credits_balance        INTEGER NOT NULL DEFAULT 0 CHECK (extra_credits_balance >= 0),
  period_start                 TIMESTAMPTZ,
  period_end                   TIMESTAMPTZ,
  stripe_customer_id           TEXT,
  stripe_subscription_id       TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER creator_studio_entitlements_touch_updated_at
  BEFORE UPDATE ON public.creator_studio_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.creator_studio_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_studio_entitlements_owner_select
  ON public.creator_studio_entitlements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies for `authenticated` at all: every write
-- to this table happens inside the SECURITY DEFINER RPCs below, or via
-- service_role from the Stripe webhook. A client can never move its own
-- quota counters.
REVOKE ALL ON public.creator_studio_entitlements FROM anon;
GRANT SELECT ON public.creator_studio_entitlements TO authenticated;
GRANT ALL ON public.creator_studio_entitlements TO service_role;

-- ----------------------------------------------------------------------------
-- 2. creator_studio_projects
-- ----------------------------------------------------------------------------
CREATE TABLE public.creator_studio_projects (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_product_id       UUID REFERENCES public.marketplace_products(id) ON DELETE SET NULL,
  project_type            TEXT NOT NULL CHECK (project_type IN (
                             'EBOOK_PROMO','COURSE_PROMO','PLANNER_PROMO','TIKTOK_AD',
                             'INSTAGRAM_REEL','PRODUCT_TRAILER','BOOK_TRAILER'
                           )),
  title                   TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  cta_text                TEXT NOT NULL DEFAULT 'Shop Now' CHECK (char_length(cta_text) <= 60),
  price_text              TEXT CHECK (price_text IS NULL OR char_length(price_text) <= 40),
  destination_url         TEXT CHECK (destination_url IS NULL OR char_length(destination_url) <= 2000),
  style_preset            TEXT NOT NULL CHECK (style_preset IN (
                             'LUXURY_EDITORIAL','BOLD_SOCIAL','CINEMATIC',
                             'CLEAN_MINIMAL','CREATOR_ENERGY','BOOK_TRAILER'
                           )),
  duration_seconds        INTEGER NOT NULL CHECK (duration_seconds IN (15, 30, 45)),
  -- V1 ships vertical only. Widening to horizontal/square later is a single
  -- constraint swap (DROP/ADD CHECK) -- no column or table replacement.
  aspect_ratio             TEXT NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('9:16')),
  status                   TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                             'DRAFT','READY','GENERATING','COMPLETE','FAILED','ARCHIVED'
                           )),
  current_template_version TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX creator_studio_projects_owner_idx ON public.creator_studio_projects(owner_user_id, created_at DESC);
CREATE INDEX creator_studio_projects_source_product_idx ON public.creator_studio_projects(source_product_id) WHERE source_product_id IS NOT NULL;

CREATE TRIGGER creator_studio_projects_touch_updated_at
  BEFORE UPDATE ON public.creator_studio_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Shared owner-immutability guard: reused by both projects and assets below.
-- Blocks any UPDATE that tries to move a row to a different owner, even
-- though authenticated already only has UPDATE on rows it owns via RLS --
-- this is defense-in-depth against a future policy-authoring mistake.
CREATE FUNCTION public.guard_creator_studio_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'creator_studio.%: owner_user_id cannot be changed', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER creator_studio_projects_guard_owner
  BEFORE UPDATE ON public.creator_studio_projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_creator_studio_owner();

ALTER TABLE public.creator_studio_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_studio_projects_owner_select
  ON public.creator_studio_projects FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY creator_studio_projects_owner_insert
  ON public.creator_studio_projects FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY creator_studio_projects_owner_update
  ON public.creator_studio_projects FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- No DELETE policy anywhere: projects are archived (status='ARCHIVED'), never
-- destroyed, so render history and usage ledger references stay valid.
REVOKE ALL ON public.creator_studio_projects FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.creator_studio_projects TO authenticated;
GRANT ALL ON public.creator_studio_projects TO service_role;

-- ----------------------------------------------------------------------------
-- 3. creator_studio_assets -- source uploads AND provider outputs/thumbnails.
-- ----------------------------------------------------------------------------
CREATE TABLE public.creator_studio_assets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type     TEXT NOT NULL CHECK (asset_type IN (
                    'COVER','SCREENSHOT','LOGO','OTHER_IMAGE','VIDEO_OUTPUT','THUMBNAIL'
                  )),
  source_type    TEXT NOT NULL DEFAULT 'UPLOADED' CHECK (source_type IN (
                    'UPLOADED','FROM_PRODUCT','PROVIDER_OUTPUT'
                  )),
  storage_bucket TEXT NOT NULL CHECK (storage_bucket IN ('creator-studio-source-assets','creator-studio-renders')),
  storage_path   TEXT NOT NULL CHECK (char_length(storage_path) BETWEEN 1 AND 1000),
  media_type     TEXT NOT NULL CHECK (char_length(media_type) BETWEEN 1 AND 100),
  size_bytes     BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  width          INTEGER CHECK (width IS NULL OR width > 0),
  height         INTEGER CHECK (height IS NULL OR height > 0),
  checksum       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A row of type VIDEO_OUTPUT/THUMBNAIL must live in the renders bucket;
  -- everything else must live in the source-assets bucket. Keeps the two
  -- private buckets' access policies aligned with what's actually stored.
  CONSTRAINT creator_studio_assets_bucket_matches_type CHECK (
    (asset_type IN ('VIDEO_OUTPUT','THUMBNAIL') AND storage_bucket = 'creator-studio-renders')
    OR
    (asset_type NOT IN ('VIDEO_OUTPUT','THUMBNAIL') AND storage_bucket = 'creator-studio-source-assets')
  )
);

CREATE INDEX creator_studio_assets_owner_idx ON public.creator_studio_assets(owner_user_id, created_at DESC);

CREATE TRIGGER creator_studio_assets_guard_owner
  BEFORE UPDATE ON public.creator_studio_assets
  FOR EACH ROW EXECUTE FUNCTION public.guard_creator_studio_owner();

ALTER TABLE public.creator_studio_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_studio_assets_owner_select
  ON public.creator_studio_assets FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY creator_studio_assets_owner_insert
  ON public.creator_studio_assets FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND source_type != 'PROVIDER_OUTPUT');

-- No UPDATE policy: an uploaded asset's metadata is immutable once recorded
-- (re-upload creates a new row instead). No DELETE: assets referenced by
-- past render jobs must stay resolvable for audit/reproducibility.
REVOKE ALL ON public.creator_studio_assets FROM anon;
GRANT SELECT, INSERT ON public.creator_studio_assets TO authenticated;
GRANT ALL ON public.creator_studio_assets TO service_role;

-- ----------------------------------------------------------------------------
-- 4. creator_studio_project_assets -- join table (project <-> asset), ordered.
-- ----------------------------------------------------------------------------
CREATE TABLE public.creator_studio_project_assets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES public.creator_studio_projects(id) ON DELETE CASCADE,
  asset_id       UUID NOT NULL REFERENCES public.creator_studio_assets(id) ON DELETE CASCADE,
  owner_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           TEXT NOT NULL CHECK (role IN ('COVER','SCREENSHOT','LOGO','OUTPUT','THUMBNAIL')),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, asset_id)
);

CREATE INDEX creator_studio_project_assets_project_idx
  ON public.creator_studio_project_assets(project_id, sort_order);

ALTER TABLE public.creator_studio_project_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_studio_project_assets_owner_select
  ON public.creator_studio_project_assets FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Insert requires the caller to own BOTH the project and the asset being
-- attached -- a client cannot attach someone else's asset to their own
-- project merely by knowing its UUID.
CREATE POLICY creator_studio_project_assets_owner_insert
  ON public.creator_studio_project_assets FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.creator_studio_projects p
      WHERE p.id = project_id AND p.owner_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.creator_studio_assets a
      WHERE a.id = asset_id AND a.owner_user_id = auth.uid()
    )
  );

CREATE POLICY creator_studio_project_assets_owner_update
  ON public.creator_studio_project_assets FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY creator_studio_project_assets_owner_delete
  ON public.creator_studio_project_assets FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());
-- DELETE is allowed here (unlike every other Creator Studio table): removing
-- an asset from a still-DRAFT project's storyboard is normal wizard usage
-- (e.g. swapping a screenshot) and deletes only the join row, never the
-- underlying asset or any render history -- no reproducibility loss.

REVOKE ALL ON public.creator_studio_project_assets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_studio_project_assets TO authenticated;
GRANT ALL ON public.creator_studio_project_assets TO service_role;

-- ----------------------------------------------------------------------------
-- 5. creator_studio_render_jobs
-- ----------------------------------------------------------------------------
CREATE TABLE public.creator_studio_render_jobs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  UUID NOT NULL REFERENCES public.creator_studio_projects(id) ON DELETE CASCADE,
  owner_user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider                    TEXT NOT NULL DEFAULT 'shotstack',
  provider_job_id              TEXT,
  template_key                TEXT NOT NULL,
  template_version             TEXT NOT NULL,
  status                       TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
                                 'QUEUED','SUBMITTED','RENDERING','SUCCEEDED','FAILED','CANCELLED'
                               )),
  duration_seconds             INTEGER NOT NULL CHECK (duration_seconds IN (15, 30, 45)),
  output_format                TEXT NOT NULL DEFAULT 'mp4',
  resolution                   TEXT NOT NULL DEFAULT '1080x1920',
  estimated_provider_cost_cents INTEGER CHECK (estimated_provider_cost_cents IS NULL OR estimated_provider_cost_cents >= 0),
  final_provider_cost_cents     INTEGER CHECK (final_provider_cost_cents IS NULL OR final_provider_cost_cents >= 0),
  output_asset_id               UUID REFERENCES public.creator_studio_assets(id) ON DELETE SET NULL,
  error_code                    TEXT,
  safe_error_message            TEXT,
  idempotency_key                TEXT NOT NULL UNIQUE,
  started_at                     TIMESTAMPTZ,
  completed_at                   TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX creator_studio_render_jobs_owner_idx ON public.creator_studio_render_jobs(owner_user_id, created_at DESC);
CREATE INDEX creator_studio_render_jobs_project_idx ON public.creator_studio_render_jobs(project_id);
CREATE INDEX creator_studio_render_jobs_provider_job_idx ON public.creator_studio_render_jobs(provider, provider_job_id) WHERE provider_job_id IS NOT NULL;

-- At most one job "in flight" per project, independent of idempotency keys --
-- the DB-level backstop against double-submission (double-click, refresh,
-- retry) referenced in the CS3/CS4 idempotency requirements.
CREATE UNIQUE INDEX creator_studio_render_jobs_one_active_per_project
  ON public.creator_studio_render_jobs(project_id)
  WHERE status IN ('QUEUED','SUBMITTED','RENDERING');

CREATE TRIGGER creator_studio_render_jobs_touch_updated_at
  BEFORE UPDATE ON public.creator_studio_render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.creator_studio_render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_studio_render_jobs_owner_select
  ON public.creator_studio_render_jobs FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- The user-facing "submit" server function creates this row (status=QUEUED)
-- inside the same request that reserves the entitlement. Every subsequent
-- status transition is provider/webhook-driven and happens only through
-- service_role (see CS3 adapter) -- authenticated has no UPDATE policy here.
CREATE POLICY creator_studio_render_jobs_owner_insert
  ON public.creator_studio_render_jobs FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND status = 'QUEUED'
    AND EXISTS (
      SELECT 1 FROM public.creator_studio_projects p
      WHERE p.id = project_id AND p.owner_user_id = auth.uid()
    )
  );

REVOKE ALL ON public.creator_studio_render_jobs FROM anon;
GRANT SELECT, INSERT ON public.creator_studio_render_jobs TO authenticated;
GRANT ALL ON public.creator_studio_render_jobs TO service_role;

-- ----------------------------------------------------------------------------
-- 6. creator_studio_provider_events -- raw webhook audit + idempotency log.
-- ----------------------------------------------------------------------------
CREATE TABLE public.creator_studio_provider_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  render_job_id    UUID REFERENCES public.creator_studio_render_jobs(id) ON DELETE SET NULL,
  provider         TEXT NOT NULL DEFAULT 'shotstack',
  provider_event_id TEXT,
  event_type       TEXT NOT NULL,
  raw_status       TEXT,
  -- Dedupe key is provider_event_id when the provider supplies one, else a
  -- caller-derived hash of (provider_job_id, event_type, raw_status,
  -- observed transition). Either way it is unique, which is what makes
  -- webhook replays a no-op at the DB layer regardless of the adapter's own
  -- idempotency bookkeeping.
  dedupe_key        TEXT NOT NULL UNIQUE,
  payload_summary    JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed          BOOLEAN NOT NULL DEFAULT false,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX creator_studio_provider_events_render_job_idx ON public.creator_studio_provider_events(render_job_id);

ALTER TABLE public.creator_studio_provider_events ENABLE ROW LEVEL SECURITY;

-- Fully internal: no policies for `authenticated` at all (not even SELECT --
-- this table is raw provider payload metadata, never customer-facing).
REVOKE ALL ON public.creator_studio_provider_events FROM anon;
REVOKE ALL ON public.creator_studio_provider_events FROM authenticated;
GRANT ALL ON public.creator_studio_provider_events TO service_role;

-- ----------------------------------------------------------------------------
-- 7. creator_studio_usage_ledger -- append-only entitlement audit trail.
-- ----------------------------------------------------------------------------
CREATE TABLE public.creator_studio_usage_ledger (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id             UUID REFERENCES public.creator_studio_projects(id) ON DELETE SET NULL,
  render_job_id          UUID REFERENCES public.creator_studio_render_jobs(id) ON DELETE SET NULL,
  event_type             TEXT NOT NULL CHECK (event_type IN (
                            'RESERVE','CONSUME','RELEASE','PURCHASE_CREDIT',
                            'GRANT_FREE_PREVIEW','SUBSCRIPTION_ACTIVATE','SUBSCRIPTION_RESET'
                          )),
  source                 TEXT CHECK (source IS NULL OR source IN ('FREE_PREVIEW','INCLUDED','EXTRA_CREDIT')),
  amount                 INTEGER NOT NULL,
  idempotency_key         TEXT NOT NULL UNIQUE,
  balance_after_included   INTEGER,
  balance_after_extra       INTEGER,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX creator_studio_usage_ledger_user_idx ON public.creator_studio_usage_ledger(user_id, created_at DESC);

ALTER TABLE public.creator_studio_usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_studio_usage_ledger_owner_select
  ON public.creator_studio_usage_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- No write policies for `authenticated`: every row is inserted from inside
-- the SECURITY DEFINER RPCs below.
REVOKE ALL ON public.creator_studio_usage_ledger FROM anon;
GRANT SELECT ON public.creator_studio_usage_ledger TO authenticated;
GRANT ALL ON public.creator_studio_usage_ledger TO service_role;

-- ============================================================================
-- Entitlement RPCs -- the only way any counter in creator_studio_entitlements
-- ever changes. Each is idempotent on its own idempotency key and takes a
-- `FOR UPDATE` lock on the user's entitlements row so concurrent requests
-- for the SAME user serialize instead of racing (different users touch
-- different rows, so there is no cross-user contention to worry about).
-- ============================================================================

-- Reserve one video credit for `p_user_id`, called synchronously from the
-- user-facing "submit render" server function BEFORE the provider is ever
-- called. Idempotent: calling it twice with the same idempotency_key returns
-- the first call's result instead of reserving twice (covers double-click,
-- page refresh mid-submit, and server-side retry of the same request).
CREATE FUNCTION public.creator_studio_reserve_video_credit(
  p_user_id UUID,
  p_project_id UUID,
  p_idempotency_key TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.creator_studio_usage_ledger%ROWTYPE;
  v_row public.creator_studio_entitlements%ROWTYPE;
  v_source TEXT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'creator_studio_reserve_video_credit: caller does not match p_user_id';
  END IF;

  -- Idempotency short-circuit: a prior RESERVE with this exact key already
  -- ran to completion (committed), so replay it without touching counters.
  SELECT * INTO v_existing FROM public.creator_studio_usage_ledger
  WHERE idempotency_key = p_idempotency_key AND event_type = 'RESERVE';
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'ALREADY_RESERVED',
      'source', v_existing.source,
      'balanceAfterIncluded', v_existing.balance_after_included,
      'balanceAfterExtra', v_existing.balance_after_extra
    );
  END IF;

  -- Serialize concurrent reservations for this one user.
  SELECT * INTO v_row FROM public.creator_studio_entitlements
  WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.creator_studio_entitlements (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_row;
  END IF;

  IF v_row.plan = 'FREE' THEN
    IF v_row.free_preview_used THEN
      RETURN jsonb_build_object('status', 'DENIED_NO_CREDITS', 'source', NULL);
    END IF;
    v_source := 'FREE_PREVIEW';
    UPDATE public.creator_studio_entitlements
    SET free_preview_used = true
    WHERE user_id = p_user_id
    RETURNING * INTO v_row;
  ELSIF v_row.videos_used_this_period < v_row.videos_included_per_period THEN
    v_source := 'INCLUDED';
    UPDATE public.creator_studio_entitlements
    SET videos_used_this_period = videos_used_this_period + 1
    WHERE user_id = p_user_id
    RETURNING * INTO v_row;
  ELSIF v_row.extra_credits_balance > 0 THEN
    v_source := 'EXTRA_CREDIT';
    UPDATE public.creator_studio_entitlements
    SET extra_credits_balance = extra_credits_balance - 1
    WHERE user_id = p_user_id
    RETURNING * INTO v_row;
  ELSE
    RETURN jsonb_build_object('status', 'DENIED_NO_CREDITS', 'source', NULL);
  END IF;

  INSERT INTO public.creator_studio_usage_ledger (
    user_id, project_id, event_type, source, amount, idempotency_key,
    balance_after_included, balance_after_extra
  ) VALUES (
    p_user_id, p_project_id, 'RESERVE', v_source, -1, p_idempotency_key,
    v_row.videos_included_per_period - v_row.videos_used_this_period,
    v_row.extra_credits_balance
  );

  RETURN jsonb_build_object(
    'status', 'RESERVED',
    'source', v_source,
    'balanceAfterIncluded', v_row.videos_included_per_period - v_row.videos_used_this_period,
    'balanceAfterExtra', v_row.extra_credits_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.creator_studio_reserve_video_credit(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_studio_reserve_video_credit(UUID, UUID, TEXT) TO authenticated;

-- Mark a reservation permanently consumed (provider render SUCCEEDED). This
-- performs NO counter mutation -- the credit was already spent at RESERVE
-- time -- it only closes the reservation so a later RELEASE call for the
-- same key is rejected instead of double-crediting a video that shipped.
-- service_role only: called from the Shotstack webhook handler, which has
-- no user session to satisfy the reserve RPC's auth.uid() check.
CREATE FUNCTION public.creator_studio_finalize_consumption(
  p_user_id UUID,
  p_reserve_idempotency_key TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserve public.creator_studio_usage_ledger%ROWTYPE;
  v_finalize_key TEXT := 'finalize:' || p_reserve_idempotency_key;
BEGIN
  SELECT * INTO v_reserve FROM public.creator_studio_usage_ledger
  WHERE idempotency_key = p_reserve_idempotency_key AND event_type = 'RESERVE' AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'NO_MATCHING_RESERVATION');
  END IF;

  IF EXISTS (SELECT 1 FROM public.creator_studio_usage_ledger WHERE idempotency_key = v_finalize_key) THEN
    RETURN jsonb_build_object('status', 'ALREADY_FINALIZED');
  END IF;
  IF EXISTS (SELECT 1 FROM public.creator_studio_usage_ledger WHERE idempotency_key = 'release:' || p_reserve_idempotency_key) THEN
    RETURN jsonb_build_object('status', 'ALREADY_RELEASED');
  END IF;

  INSERT INTO public.creator_studio_usage_ledger (
    user_id, project_id, render_job_id, event_type, source, amount, idempotency_key
  ) VALUES (
    p_user_id, v_reserve.project_id, v_reserve.render_job_id, 'CONSUME', v_reserve.source, 0, v_finalize_key
  );

  RETURN jsonb_build_object('status', 'FINALIZED');
END;
$$;

REVOKE ALL ON FUNCTION public.creator_studio_finalize_consumption(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_studio_finalize_consumption(UUID, TEXT) TO service_role;

-- Reverse a reservation (provider render FAILED, or timed out before ever
-- reaching the provider). Refuses to credit back a reservation that was
-- already finalized -- a successful render can never be "un-consumed" by a
-- late/duplicate failure signal. service_role only, same reasoning as above.
CREATE FUNCTION public.creator_studio_release_reservation(
  p_user_id UUID,
  p_reserve_idempotency_key TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserve public.creator_studio_usage_ledger%ROWTYPE;
  v_release_key TEXT := 'release:' || p_reserve_idempotency_key;
BEGIN
  SELECT * INTO v_reserve FROM public.creator_studio_usage_ledger
  WHERE idempotency_key = p_reserve_idempotency_key AND event_type = 'RESERVE' AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'NO_MATCHING_RESERVATION');
  END IF;

  IF EXISTS (SELECT 1 FROM public.creator_studio_usage_ledger WHERE idempotency_key = 'finalize:' || p_reserve_idempotency_key) THEN
    RETURN jsonb_build_object('status', 'ALREADY_FINALIZED');
  END IF;
  IF EXISTS (SELECT 1 FROM public.creator_studio_usage_ledger WHERE idempotency_key = v_release_key) THEN
    RETURN jsonb_build_object('status', 'ALREADY_RELEASED');
  END IF;

  PERFORM 1 FROM public.creator_studio_entitlements WHERE user_id = p_user_id FOR UPDATE;

  IF v_reserve.source = 'FREE_PREVIEW' THEN
    UPDATE public.creator_studio_entitlements SET free_preview_used = false WHERE user_id = p_user_id;
  ELSIF v_reserve.source = 'INCLUDED' THEN
    UPDATE public.creator_studio_entitlements
    SET videos_used_this_period = GREATEST(0, videos_used_this_period - 1)
    WHERE user_id = p_user_id;
  ELSIF v_reserve.source = 'EXTRA_CREDIT' THEN
    UPDATE public.creator_studio_entitlements SET extra_credits_balance = extra_credits_balance + 1 WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.creator_studio_usage_ledger (
    user_id, project_id, render_job_id, event_type, source, amount, idempotency_key
  ) VALUES (
    p_user_id, v_reserve.project_id, v_reserve.render_job_id, 'RELEASE', v_reserve.source, 1, v_release_key
  );

  RETURN jsonb_build_object('status', 'RELEASED', 'source', v_reserve.source);
END;
$$;

REVOKE ALL ON FUNCTION public.creator_studio_release_reservation(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_studio_release_reservation(UUID, TEXT) TO service_role;

-- Apply a fulfilled Stripe purchase (extra credit) or subscription state
-- change (Pro/Business activation, renewal reset, cancellation-to-FREE) to
-- the entitlements row. Idempotent on the Stripe event id -- replays of the
-- same webhook event (Stripe's own retry behavior) are a no-op. service_role
-- only: called exclusively from the payments webhook handler.
CREATE FUNCTION public.creator_studio_apply_stripe_fulfillment(
  p_user_id UUID,
  p_kind TEXT,
  p_stripe_event_id TEXT,
  p_period_end TIMESTAMPTZ DEFAULT NULL,
  p_extra_credits INTEGER DEFAULT 1,
  p_videos_included INTEGER DEFAULT NULL,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := 'stripe:' || p_stripe_event_id;
BEGIN
  IF p_kind NOT IN ('EXTRA_CREDIT', 'SUBSCRIPTION_PRO', 'SUBSCRIPTION_BUSINESS', 'SUBSCRIPTION_CANCELLED') THEN
    RAISE EXCEPTION 'creator_studio_apply_stripe_fulfillment: invalid p_kind %', p_kind;
  END IF;

  IF EXISTS (SELECT 1 FROM public.creator_studio_usage_ledger WHERE idempotency_key = v_key) THEN
    RETURN jsonb_build_object('status', 'ALREADY_APPLIED');
  END IF;

  INSERT INTO public.creator_studio_entitlements (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM 1 FROM public.creator_studio_entitlements WHERE user_id = p_user_id FOR UPDATE;

  IF p_kind = 'EXTRA_CREDIT' THEN
    UPDATE public.creator_studio_entitlements
    SET extra_credits_balance = extra_credits_balance + p_extra_credits,
        stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id)
    WHERE user_id = p_user_id;
    INSERT INTO public.creator_studio_usage_ledger (user_id, event_type, amount, idempotency_key)
    VALUES (p_user_id, 'PURCHASE_CREDIT', p_extra_credits, v_key);
  ELSIF p_kind IN ('SUBSCRIPTION_PRO', 'SUBSCRIPTION_BUSINESS') THEN
    UPDATE public.creator_studio_entitlements
    SET plan = p_kind,
        videos_included_per_period = COALESCE(p_videos_included, CASE WHEN p_kind = 'SUBSCRIPTION_PRO' THEN 10 ELSE 50 END),
        videos_used_this_period = 0,
        period_start = now(),
        period_end = p_period_end,
        stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
        stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id)
    WHERE user_id = p_user_id;
    INSERT INTO public.creator_studio_usage_ledger (user_id, event_type, amount, idempotency_key)
    VALUES (p_user_id, 'SUBSCRIPTION_ACTIVATE', 0, v_key);
  ELSIF p_kind = 'SUBSCRIPTION_CANCELLED' THEN
    UPDATE public.creator_studio_entitlements
    SET plan = 'FREE',
        videos_included_per_period = 0,
        videos_used_this_period = 0,
        period_start = NULL,
        period_end = NULL,
        stripe_subscription_id = NULL
    WHERE user_id = p_user_id;
    INSERT INTO public.creator_studio_usage_ledger (user_id, event_type, amount, idempotency_key)
    VALUES (p_user_id, 'SUBSCRIPTION_RESET', 0, v_key);
  END IF;

  RETURN jsonb_build_object('status', 'APPLIED', 'kind', p_kind);
END;
$$;

REVOKE ALL ON FUNCTION public.creator_studio_apply_stripe_fulfillment(UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_studio_apply_stripe_fulfillment(UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, TEXT, TEXT) TO service_role;

-- ============================================================================
-- Storage -- two private buckets. Neither is ever public; every access is
-- either an owner-scoped RLS-gated direct read or a server-minted signed URL.
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('creator-studio-source-assets', 'creator-studio-source-assets', false),
  ('creator-studio-renders', 'creator-studio-renders', false)
ON CONFLICT (id) DO NOTHING;

-- Source assets: user uploads directly into their own folder,
-- storage path convention: <user_id>/<asset_id>-<filename>.
CREATE POLICY creator_studio_source_assets_owner_select
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'creator-studio-source-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY creator_studio_source_assets_owner_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'creator-studio-source-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- No UPDATE/DELETE policy: matches the assets table's own immutability
-- (a bad upload is replaced by a new object + new asset row, not edited).

-- Renders: server/service-role writes only (the adapter copies the finished
-- output in after the provider completes). Authenticated gets a scoped read
-- policy as defense-in-depth even though the app always hands out signed
-- URLs rather than relying on this policy for delivery.
CREATE POLICY creator_studio_renders_owner_select
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'creator-studio-renders' AND (storage.foldername(name))[1] = auth.uid()::text);
-- No INSERT/UPDATE/DELETE policy for authenticated on this bucket at all.
