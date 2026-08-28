-- AurumVault third-party integration OAuth foundation.
--
-- integration_connections is deliberately provider-neutral — the `provider`
-- column is the only thing that varies for a future Etsy/Printful/Stripe
-- Connect integration; the pending -> connected -> revoked lifecycle,
-- ownership model, and column-security posture below are reusable as-is.
--
-- Security model, mirroring this codebase's most sensitive existing table
-- patterns (qr_projects' owner-only RLS, and the seller-onboarding table's
-- service-role-only writes):
--   - Only non-sensitive columns (id, provider, status, timestamps) are ever
--     GRANTed to `authenticated` at all — state, code_verifier, and the
--     encrypted token envelope are never selectable by any client, at any
--     RLS condition, because they're simply never granted. This is stronger
--     than an RLS policy alone (RLS can't do column-level exclusion).
--   - No INSERT/UPDATE/DELETE policy exists for `authenticated` at all. A
--     connection can only ever be created, completed, or revoked by
--     server-side code using the service-role client, explicitly scoped by
--     owner_user_id in application code (the same pattern
--     saveMyStorefrontProfile uses for its own seller-onboarding-table
--     writes) — never through a client-facing RLS write path. This is
--     intentional: unlike a QR project (safe for an owner to directly
--     mutate under RLS), a
--     connection's state machine (pending -> connected) must only ever be
--     advanced by a verified OAuth exchange, never by a direct client write.
--   - access_token/refresh_token are stored as an application-layer AES-256-
--     GCM envelope (src/lib/oauth-token-crypto.server.ts), not plaintext —
--     defense in depth beyond the column-grant restriction above, matching
--     this codebase's existing payout-details encryption precedent.
CREATE TABLE public.integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('canva')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'revoked', 'error')),

  -- Pending-connection material. Cleared (set NULL) the moment a connection
  -- resolves to 'connected', 'revoked', or 'error' — nothing here should
  -- outlive the single OAuth round-trip it was generated for.
  state TEXT,
  code_verifier TEXT,
  request_expires_at TIMESTAMPTZ,

  -- Encrypted token material (oauth-token-crypto.server.ts envelope: jsonb
  -- of shape {__enc, kid, iv, data}). NULL until 'connected'.
  token_envelope JSONB,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One connection row per user per provider — starting a new connection
  -- attempt reuses (resets) the existing row rather than accumulating
  -- duplicates, which also makes "disconnect" and "am I connected" simple
  -- single-row lookups.
  CONSTRAINT integration_connections_owner_provider_unique UNIQUE (owner_user_id, provider)
);

CREATE INDEX integration_connections_owner_idx ON public.integration_connections (owner_user_id);
-- Only ever looked up by state during the callback, and only while pending;
-- a partial index keeps it small and keeps completed/revoked rows out of it.
CREATE UNIQUE INDEX integration_connections_pending_state_idx
  ON public.integration_connections (state)
  WHERE status = 'pending' AND state IS NOT NULL;

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

-- Row-level: the owner (or an admin) may read their own row. Combined with
-- the column grant below, this only ever exposes non-sensitive fields.
CREATE POLICY "integration_connections_owner_read" ON public.integration_connections
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Column-level: state/code_verifier/token_envelope/token_expires_at/scope
-- are never granted to `authenticated` at all — only the safe status
-- fields an "Integrations" settings page actually needs to render
-- Connected/Not Connected.
GRANT SELECT (id, provider, status, created_at, updated_at) ON public.integration_connections TO authenticated;
GRANT ALL ON public.integration_connections TO service_role;
REVOKE ALL ON public.integration_connections FROM anon;

CREATE TRIGGER trg_integration_connections_updated
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Defense in depth: even though there is no authenticated write policy at
-- all today, this blocks ownership reassignment at the database layer
-- permanently, the same way qr_projects_guard_identity() does — so a
-- future, mistakenly-added client write path could never hijack another
-- user's connection row.
CREATE OR REPLACE FUNCTION public.integration_connections_guard_identity()
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
    RAISE EXCEPTION 'Integration connection ownership cannot be reassigned';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.integration_connections_guard_identity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.integration_connections_guard_identity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.integration_connections_guard_identity() FROM authenticated;

CREATE TRIGGER integration_connections_guard_identity_trg
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.integration_connections_guard_identity();
