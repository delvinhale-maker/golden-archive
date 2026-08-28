CREATE TABLE public.integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('canva')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'connected', 'revoked', 'error')),
  external_account_id TEXT,
  external_display_name TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  access_token_enc JSONB,
  refresh_token_enc JSONB,
  access_token_expires_at TIMESTAMPTZ,
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

CREATE UNIQUE INDEX integration_connections_user_provider_key
  ON public.integration_connections (user_id, provider);

CREATE UNIQUE INDEX integration_connections_oauth_state_key
  ON public.integration_connections (oauth_state)
  WHERE oauth_state IS NOT NULL;

CREATE INDEX integration_connections_provider_status_idx
  ON public.integration_connections (provider, status);

GRANT ALL ON public.integration_connections TO service_role;

GRANT SELECT (
  id,
  user_id,
  provider,
  status,
  external_display_name,
  scopes,
  last_connected_at,
  access_token_expires_at,
  last_error,
  created_at,
  updated_at
) ON public.integration_connections TO authenticated;

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_connections_owner_read"
  ON public.integration_connections
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "integration_connections_owner_delete"
  ON public.integration_connections
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_integration_connection_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'integration_connections.user_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_integration_connections_owner_guard
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.guard_integration_connection_owner();

REVOKE ALL ON public.integration_connections FROM anon;

CREATE TRIGGER trg_integration_connections_updated
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.integration_connections IS
  'Per-user OAuth connections to external providers. Token columns are envelope-encrypted with INTEGRATION_TOKEN_ENCRYPTION_KEY; access is service-role only.';