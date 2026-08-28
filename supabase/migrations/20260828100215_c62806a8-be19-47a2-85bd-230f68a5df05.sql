REVOKE ALL ON public.integration_connections FROM authenticated;
REVOKE ALL ON public.integration_connections FROM anon;

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

GRANT DELETE ON public.integration_connections TO authenticated;

GRANT ALL ON public.integration_connections TO service_role;