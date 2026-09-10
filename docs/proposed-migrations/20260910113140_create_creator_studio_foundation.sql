-- AurumVault Creator Studio™ — CS1 foundation (ADDITIVE ONLY — NOT APPLIED).
--
-- STATUS: proposed / unapplied. Staged here on purpose, for the same reason
-- as every other file in this directory: the platform's migration runner
-- only executes SQL placed under supabase/migrations/, which applies
-- immediately against the shared preview+production database. This pass is
-- source-only. Copy into a real migration only under explicit authorization,
-- and only against an isolated staging backend first (see the CS1 report).
--
-- Nothing existing is altered: no DROP, no TRUNCATE, no DELETE, no ALTER of
-- any pre-existing table, column, policy, or function. References the
-- existing helpers public.has_role(uuid, app_role) and
-- public.touch_updated_at() without redefining them, and the existing
-- public.marketplace_products table via an optional (nullable) FK — a
-- Creator Studio project can exist with no linked product ("Upload a
-- Product" path).
--
-- SCOPE: this migration creates ONLY the four tables and two private
-- storage buckets CS1 needs to exist as a safe, inert foundation. It does
-- NOT wire up rendering (no Shotstack calls exist anywhere in this
-- codebase yet), billing, or publishing — those are separate, later gates,
-- each behind its own feature flag (see
-- src/lib/creator-studio-feature-flags.ts).
--
-- ENTITLEMENTS: there is no subscription/entitlement/plan table anywhere in
-- this codebase today (confirmed by the existing rights-passport-foundation
-- branch's own dedicated audit, independently re-confirmed here — the
-- existing Stripe integration is a one-time `mode: "payment"` marketplace
-- checkout, never `mode: "subscription"`). This migration does not invent
-- one. See the CS1 report for the recommended future
-- creator_studio_entitlements shape, modeled on the one analogous existing
-- precedent (rights_passport_entitlements).
--
-- ROLLBACK
--   Fully reversible and self-contained:
--     DROP TABLE IF EXISTS public.creator_studio_outputs CASCADE;
--     DROP TABLE IF EXISTS public.creator_studio_render_jobs CASCADE;
--     DROP TABLE IF EXISTS public.creator_studio_assets CASCADE;
--     DROP TABLE IF EXISTS public.creator_studio_projects CASCADE;
--     DELETE FROM storage.objects WHERE bucket_id IN ('creator-studio-assets','creator-studio-renders');
--     DELETE FROM storage.buckets WHERE id IN ('creator-studio-assets','creator-studio-renders');
--   (drops indexes/policies/triggers with their tables; touches nothing else).

-- ============================================================================
-- creator_studio_projects
-- ============================================================================
CREATE TABLE public.creator_studio_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Optional source product ("Use an AurumVault Product" path). Nullable —
  -- "Upload a Product" leaves this null. ON DELETE SET NULL (not CASCADE):
  -- deleting the source product should not destroy a creator's in-progress
  -- or completed video project.
  product_id UUID REFERENCES public.marketplace_products(id) ON DELETE SET NULL,

  project_name TEXT NOT NULL DEFAULT 'Untitled video project'
    CHECK (char_length(project_name) BETWEEN 1 AND 200),

  creation_type TEXT NOT NULL CHECK (creation_type IN (
    'EBOOK_PROMO', 'COURSE_PROMO', 'PLANNER_PROMO', 'TIKTOK_AD',
    'INSTAGRAM_REEL', 'PRODUCT_TRAILER', 'BOOK_TRAILER'
  )),

  style TEXT NOT NULL DEFAULT 'CLEAN_MINIMAL'
    CHECK (style IN ('CINEMATIC', 'LUXURY', 'BOLD_SOCIAL', 'CLEAN_MINIMAL')),

  duration_seconds INTEGER NOT NULL DEFAULT 30
    CHECK (duration_seconds IN (15, 30, 45)),

  -- V1 ships 9:16 only (see spec). A CHECK, not an enum, so widening to
  -- additional ratios later is a plain constraint change, not a type
  -- migration.
  aspect_ratio TEXT NOT NULL DEFAULT '9:16' CHECK (aspect_ratio = '9:16'),

  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'READY', 'QUEUED', 'RENDERING', 'COMPLETED', 'FAILED', 'CANCELLED'
  )),

  -- Wizard-editable copy for the video, pre-filled from the source product
  -- when one is linked but always stored as the creator's own edited
  -- snapshot, never re-derived live from marketplace_products.
  headline TEXT CHECK (headline IS NULL OR char_length(headline) <= 200),
  cta_text TEXT CHECK (cta_text IS NULL OR char_length(cta_text) <= 60),
  cta_url TEXT CHECK (cta_url IS NULL OR char_length(cta_url) <= 2000),
  price_text TEXT CHECK (price_text IS NULL OR char_length(price_text) <= 40),

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX creator_studio_projects_owner_idx
  ON public.creator_studio_projects (owner_user_id, created_at DESC);

CREATE INDEX creator_studio_projects_product_idx
  ON public.creator_studio_projects (product_id)
  WHERE product_id IS NOT NULL;

-- ============================================================================
-- creator_studio_assets
-- ============================================================================
CREATE TABLE public.creator_studio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.creator_studio_projects(id) ON DELETE CASCADE,

  -- Denormalized owner (not just derivable via project_id) so RLS policies
  -- here don't need a subquery join for the common case — same pattern as
  -- canva_design_products.user_id alongside its product_id FK.
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  asset_type TEXT NOT NULL CHECK (asset_type IN ('PRODUCT_COVER', 'SCREENSHOT', 'LOGO')),

  storage_path TEXT NOT NULL CHECK (char_length(storage_path) BETWEEN 1 AND 500),

  -- Distinguishes a creator's own upload from an asset pulled in from their
  -- linked AurumVault product (see the product adapter in
  -- creator-studio.functions.ts). marketplace_products has no keyed
  -- per-asset id of its own (cover_url is a single column, not a joined
  -- assets table), so source_product_asset_id is a free-form reference
  -- (e.g. "cover", or a preview-page index) rather than a foreign key.
  source_type TEXT NOT NULL CHECK (source_type IN ('UPLOADED', 'FROM_PRODUCT')),
  source_product_asset_id TEXT,

  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX creator_studio_assets_project_idx
  ON public.creator_studio_assets (project_id, sort_order);

CREATE INDEX creator_studio_assets_owner_idx
  ON public.creator_studio_assets (owner_user_id);

-- ============================================================================
-- creator_studio_render_jobs — foundation only. No row is ever created by
-- this phase's code (CREATOR_STUDIO_RENDERING_ENABLED stays false and no
-- Shotstack call exists yet); the table exists so CS2 has somewhere to
-- write into without a schema migration blocking that work.
-- ============================================================================
CREATE TABLE public.creator_studio_render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.creator_studio_projects(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Single allowed value today; a CHECK (not an enum type) so adding a
  -- second provider later is a plain constraint change.
  provider TEXT NOT NULL DEFAULT 'shotstack' CHECK (provider IN ('shotstack')),
  provider_render_id TEXT,

  status TEXT NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN ('QUEUED', 'RENDERING', 'COMPLETED', 'FAILED', 'CANCELLED')),

  template_key TEXT,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds IN (15, 30, 45)),
  output_format TEXT NOT NULL DEFAULT 'mp4' CHECK (output_format = 'mp4'),
  resolution TEXT NOT NULL DEFAULT '1080x1920' CHECK (resolution = '1080x1920'),

  -- Provider cost bookkeeping — foundation only, never rendered to the
  -- customer (see the safe-error-message UX rule below).
  provider_cost_estimate NUMERIC(10, 4),
  provider_cost_actual NUMERIC(10, 4),

  error_code TEXT,
  -- Customer-safe message ONLY — the raw provider error/response is never
  -- stored in a column readable by `authenticated` (see the grant below).
  safe_error_message TEXT,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX creator_studio_render_jobs_project_idx
  ON public.creator_studio_render_jobs (project_id, created_at DESC);

CREATE INDEX creator_studio_render_jobs_owner_idx
  ON public.creator_studio_render_jobs (owner_user_id);

-- ============================================================================
-- creator_studio_outputs — foundation only, same reasoning as render_jobs.
-- ============================================================================
CREATE TABLE public.creator_studio_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.creator_studio_projects(id) ON DELETE CASCADE,
  render_job_id UUID NOT NULL REFERENCES public.creator_studio_render_jobs(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  storage_path TEXT NOT NULL CHECK (char_length(storage_path) BETWEEN 1 AND 500),
  preview_path TEXT,
  thumbnail_path TEXT,

  duration_seconds INTEGER NOT NULL CHECK (duration_seconds IN (15, 30, 45)),
  file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  width INTEGER NOT NULL DEFAULT 1080 CHECK (width > 0),
  height INTEGER NOT NULL DEFAULT 1920 CHECK (height > 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX creator_studio_outputs_project_idx
  ON public.creator_studio_outputs (project_id, created_at DESC);

CREATE INDEX creator_studio_outputs_render_job_idx
  ON public.creator_studio_outputs (render_job_id);

CREATE INDEX creator_studio_outputs_owner_idx
  ON public.creator_studio_outputs (owner_user_id);

-- ============================================================================
-- Grants + RLS
--
-- projects/assets: a creator directly owns and edits their own draft video
-- project and its assets (same posture as marketplace_products, where a
-- seller inserts/updates their own rows directly under RLS) — authenticated
-- gets SELECT/INSERT/UPDATE scoped to owner_user_id = auth.uid(). No DELETE
-- grant or policy for either: CS1 uses archive semantics (status =
-- 'CANCELLED', or an ARCHIVED-flavored status later) instead of destructive
-- deletion, per the spec.
--
-- render_jobs/outputs: these represent server-orchestrated rendering state
-- that does not exist yet in this phase (no Shotstack calls). Authenticated
-- gets SELECT only — a creator can see their own job/output rows once a
-- later phase starts writing them, but can never fabricate, edit, or delete
-- one. service_role owns every write.
-- ============================================================================

GRANT ALL ON public.creator_studio_projects TO service_role;
GRANT ALL ON public.creator_studio_assets TO service_role;
GRANT ALL ON public.creator_studio_render_jobs TO service_role;
GRANT ALL ON public.creator_studio_outputs TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.creator_studio_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.creator_studio_assets TO authenticated;
GRANT SELECT ON public.creator_studio_render_jobs TO authenticated;
GRANT SELECT ON public.creator_studio_outputs TO authenticated;

REVOKE ALL ON public.creator_studio_projects FROM anon;
REVOKE ALL ON public.creator_studio_assets FROM anon;
REVOKE ALL ON public.creator_studio_render_jobs FROM anon;
REVOKE ALL ON public.creator_studio_outputs FROM anon;

ALTER TABLE public.creator_studio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_studio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_studio_render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_studio_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_studio_projects_owner_read"
  ON public.creator_studio_projects
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "creator_studio_projects_owner_insert"
  ON public.creator_studio_projects
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "creator_studio_projects_owner_update"
  ON public.creator_studio_projects
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "creator_studio_assets_owner_read"
  ON public.creator_studio_assets
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- INSERT also requires the parent project to belong to the same caller, so
-- an asset can never be attached to another creator's project even if its
-- own owner_user_id were (incorrectly) set to the caller.
CREATE POLICY "creator_studio_assets_owner_insert"
  ON public.creator_studio_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.creator_studio_projects p
      WHERE p.id = project_id AND p.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "creator_studio_assets_owner_update"
  ON public.creator_studio_assets
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "creator_studio_render_jobs_owner_read"
  ON public.creator_studio_render_jobs
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "creator_studio_outputs_owner_read"
  ON public.creator_studio_outputs
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Owner-reassignment protection on the two directly-client-writable tables,
-- mirroring guard_integration_connection_owner /
-- guard_canva_design_product_owner: a row can never be re-pointed at a
-- different auth user, even via a client UPDATE the owner-scoped policy
-- above would otherwise allow (that policy checks the NEW row's
-- owner_user_id, not that it's unchanged from OLD).
CREATE OR REPLACE FUNCTION public.guard_creator_studio_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION '% .owner_user_id is immutable', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_creator_studio_projects_owner_guard
  BEFORE UPDATE ON public.creator_studio_projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_creator_studio_owner();

CREATE TRIGGER trg_creator_studio_assets_owner_guard
  BEFORE UPDATE ON public.creator_studio_assets
  FOR EACH ROW EXECUTE FUNCTION public.guard_creator_studio_owner();

CREATE TRIGGER trg_creator_studio_projects_updated
  BEFORE UPDATE ON public.creator_studio_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- Private storage buckets — foundation only. No public read; every access
-- later goes through a signed URL minted server-side (see the CS1 report's
-- "signed-URL strategy for later rendering integration" section). Objects
-- are namespaced by owner (first path segment = auth.uid()), mirroring the
-- canva-design-import cover-upload convention and the existing
-- product-covers/product-files buckets' per-user folder pattern.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('creator-studio-assets', 'creator-studio-assets', false),
  ('creator-studio-renders', 'creator-studio-renders', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "creator_studio_assets_storage_owner_rw"
  ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'creator-studio-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'creator-studio-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Renders are server-produced output, not a creator upload target: read
-- only for the owner, no client-side write/delete policy at all. The
-- (not-yet-built) render pipeline writes here via the service role, which
-- bypasses RLS.
CREATE POLICY "creator_studio_renders_storage_owner_read"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'creator-studio-renders' AND (storage.foldername(name))[1] = auth.uid()::text);

COMMENT ON TABLE public.creator_studio_projects IS
  'AurumVault Creator Studio™ video project — CS1 foundation. Rendering/billing are separate, flagged phases; see src/lib/creator-studio-feature-flags.ts.';
COMMENT ON TABLE public.creator_studio_assets IS
  'Source images (cover/screenshot/logo) attached to a Creator Studio project, either uploaded or pulled from a linked AurumVault product.';
COMMENT ON TABLE public.creator_studio_render_jobs IS
  'Foundation only — no row is created by any code shipped in CS1. Reserved for the CS2 rendering-provider integration.';
COMMENT ON TABLE public.creator_studio_outputs IS
  'Foundation only — no row is created by any code shipped in CS1. Reserved for the CS2 rendering-provider integration.';
