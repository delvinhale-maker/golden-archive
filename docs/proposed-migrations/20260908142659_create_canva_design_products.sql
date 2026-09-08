-- AurumVault Canva design -> product source link (ADDITIVE ONLY — NOT APPLIED).
--
-- STATUS: proposed / unapplied. Staged here on purpose, for the same reason as
-- docs/proposed-migrations/20260828004015_create_integration_connections.sql:
-- the migration runner only executes SQL placed under supabase/migrations/,
-- which applies immediately against the shared preview+production database.
-- This pass is source-only. Copy into a real migration only under explicit
-- authorization, then update this header to record the real application date.
--
-- DEPENDS ON: public.integration_connections (see the sibling migration file
-- above). This table does not reference integration_connections with a
-- foreign key — Canva design/connection lifecycles are independent (a
-- creator can disconnect Canva without losing their published products) —
-- but the import flow that populates this table requires a connected Canva
-- integration to exist first.
--
-- PURPOSE
--   The smallest durable record of "this AurumVault product came from this
--   Canva design, imported by this creator" — the foundation for:
--     - duplicate-import protection (one mapping per creator+design)
--     - a future "Refresh from Canva" / version-sync feature
--     - a future Digital Rights Passport source-provenance link
--     - future Etsy / Shopify / Lulu Print publishing, which will want the
--       same "external source -> AurumVault product" shape
--   None of those future features are implemented by this migration — only
--   the columns needed to support them later (sync_state, canva_updated_at)
--   are included, deliberately left unused beyond a default value today.
--
-- SCOPE / SAFETY
--   Additive and non-destructive: no DROP, no TRUNCATE, no DELETE, no ALTER
--   of any pre-existing table, column, policy, or function. References the
--   existing helpers public.has_role(uuid, app_role) and
--   public.touch_updated_at() without redefining them.
--
-- SECURITY MODEL
--   RLS is enabled. `authenticated` gets a read-only, owner-scoped SELECT
--   grant only (no secrets live in this table, unlike integration_connections,
--   but writes still go exclusively through server code so a verified user_id
--   from the session — never a client-supplied one — is the only thing that
--   can ever populate a row). `anon` gets nothing. Owner/admin RLS policies
--   are declared as defense-in-depth in case a grant is ever widened by
--   mistake.
--
-- ROLLBACK
--   Fully reversible and self-contained:
--     DROP TABLE IF EXISTS public.canva_design_products CASCADE;
--   (drops its own indexes, policies, and trigger; touches nothing else).

CREATE TABLE public.canva_design_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Creator who performed the import. Never re-pointed (see the owner-guard
  -- trigger below) — this is the tenancy boundary for every RLS policy here.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Canva's design identifier (from the Design object's `id` field). Not a
  -- secret — Canva design IDs are opaque but not sensitive — so no
  -- encryption is needed for this column, unlike the OAuth token columns on
  -- integration_connections.
  canva_design_id TEXT NOT NULL CHECK (char_length(canva_design_id) BETWEEN 1 AND 200),

  -- The AurumVault product this design became. Deleting the product also
  -- deletes the mapping row — there is no reason to keep an orphaned link to
  -- a product that no longer exists.
  product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,

  -- Best-effort provenance snapshot at import time — never re-derived from
  -- product_id, so it still reflects what the creator actually saw in Canva
  -- even if they later rename the AurumVault product.
  source_title TEXT,

  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Canva's own `updated_at` for the design, at the moment it was imported
  -- (unix seconds from the Connect API, stored here as a timestamp). Null
  -- when Canva didn't report one. Basis for a future "this design has
  -- changed in Canva since you imported it" affordance — not read by
  -- anything in this phase.
  canva_updated_at TIMESTAMPTZ,

  -- Foundation for a future refresh/sync feature. Only 'imported' is written
  -- by this phase; the other values are reserved.
  sync_state TEXT NOT NULL DEFAULT 'imported'
    CHECK (sync_state IN ('imported', 'stale', 'syncing', 'error')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Duplicate-import protection: exactly one mapping per (creator, Canva
-- design). The import server function checks this before creating a new
-- product, but the constraint is the actual source of truth so a race
-- between two concurrent import requests still can't create two products
-- from the same design.
CREATE UNIQUE INDEX canva_design_products_user_design_key
  ON public.canva_design_products (user_id, canva_design_id);

-- One product should only ever have one Canva source — protects against a
-- future bug reusing a product_id across two import attempts.
CREATE UNIQUE INDEX canva_design_products_product_key
  ON public.canva_design_products (product_id);

CREATE INDEX canva_design_products_user_idx
  ON public.canva_design_products (user_id);

GRANT ALL ON public.canva_design_products TO service_role;

-- No secrets in this table, but writes are still service-role only: the
-- import path always verifies the caller's identity through the session
-- (never a client-supplied user_id) before writing, and keeping INSERT off
-- the authenticated grant means a compromised or buggy client can never
-- fabricate a mapping row directly.
GRANT SELECT ON public.canva_design_products TO authenticated;

ALTER TABLE public.canva_design_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "canva_design_products_owner_read"
  ON public.canva_design_products
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "canva_design_products_owner_delete"
  ON public.canva_design_products
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Owner-reassignment protection, mirroring
-- guard_integration_connection_owner: a mapping row can never be re-pointed
-- at a different auth user, even by service-role code with a bad WHERE
-- clause.
CREATE OR REPLACE FUNCTION public.guard_canva_design_product_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'canva_design_products.user_id is immutable';
  END IF;
  IF NEW.canva_design_id IS DISTINCT FROM OLD.canva_design_id THEN
    RAISE EXCEPTION 'canva_design_products.canva_design_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_canva_design_products_owner_guard
  BEFORE UPDATE ON public.canva_design_products
  FOR EACH ROW EXECUTE FUNCTION public.guard_canva_design_product_owner();

REVOKE ALL ON public.canva_design_products FROM anon;

CREATE TRIGGER trg_canva_design_products_updated
  BEFORE UPDATE ON public.canva_design_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.canva_design_products IS
  'Per-creator record linking an imported Canva design to the AurumVault product it became. No secrets stored here; see integration_connections for OAuth material.';
