-- AurumVault third-party integration connections (ADDITIVE ONLY — NOT APPLIED).
--
-- STATUS: proposed / unapplied. Staged here on purpose. The platform will only
-- accept SQL under supabase/migrations/ through the migration runner, which
-- executes it immediately against the shared preview+production database. Since
-- this pass is source-only, the SQL lives here for static review and is copied
-- into a real migration later, under explicit authorization.
--
-- Creates the single storage surface for per-user OAuth connections to external
-- providers (first consumer: Canva). Nothing existing is altered: no DROP, no
-- TRUNCATE, no DELETE, no ALTER of any pre-existing table, column, policy, or
-- function. It references the existing helpers `public.has_role(uuid, app_role)`
-- and `public.touch_updated_at()` without redefining them.
--
-- SECURITY MODEL
--   Rows hold encrypted OAuth material. RLS is enabled and NO grants are given
--   to `anon` or `authenticated`, so neither role can read or write a row even
--   with a valid session — PostgREST returns a permission error. All access goes
--   through server code running with the service role, which scopes every query
--   by `user_id`, so tenant isolation is enforced in one audited place — the
--   same posture already used for encrypted payout details.
--   Owner/admin policies are still declared as defense-in-depth so that if a
--   grant is ever widened by mistake, cross-tenant reads remain impossible.
--
-- ROLLBACK
--   Fully reversible and self-contained:
--     DROP TABLE IF EXISTS public.integration_connections CASCADE;
--   (drops its own indexes, policies, and trigger; touches nothing else).

CREATE TABLE public.integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('canva')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'connected', 'revoked', 'error')),

  -- Provider-side identity (never a secret; used for display only).
  external_account_id TEXT,
  external_display_name TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',

  -- Envelope-encrypted secrets: { __enc, kid, iv, data } — never plaintext.
  access_token_enc JSONB,
  refresh_token_enc JSONB,
  access_token_expires_at TIMESTAMPTZ,

  -- Short-lived authorization handshake state (PKCE), cleared on completion.
  oauth_state TEXT,
  code_verifier_enc JSONB,
  state_expires_at TIMESTAMPTZ,

  last_connected_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT integration_connections_state_len
    CHECK (oauth_state IS NULL OR char_length(oauth_state) BETWEEN 16 AND 128)
);

-- Idempotency: exactly one connection row per (user, provider). Re-connecting
-- upserts the same row instead of accumulating duplicates.
CREATE UNIQUE INDEX integration_connections_user_provider_key
  ON public.integration_connections (user_id, provider);

-- The callback looks a pending handshake up by state; must be globally unique.
CREATE UNIQUE INDEX integration_connections_oauth_state_key
  ON public.integration_connections (oauth_state)
  WHERE oauth_state IS NOT NULL;

CREATE INDEX integration_connections_provider_status_idx
  ON public.integration_connections (provider, status);

-- Deliberately NO grants to anon or authenticated: encrypted OAuth material is
-- only ever touched by server code holding the service role.
GRANT ALL ON public.integration_connections TO service_role;

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth only (unreachable without grants, correct if grants change).
CREATE POLICY "integration_connections_owner_read"
  ON public.integration_connections
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "integration_connections_owner_delete"
  ON public.integration_connections
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_integration_connections_updated
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.integration_connections IS
  'Per-user OAuth connections to external providers. Token columns are envelope-encrypted with INTEGRATION_TOKEN_ENCRYPTION_KEY; access is service-role only.';
