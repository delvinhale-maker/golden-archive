ALTER TABLE public.integration_connections
  DROP CONSTRAINT IF EXISTS integration_connections_provider_check;

ALTER TABLE public.integration_connections
  ADD CONSTRAINT integration_connections_provider_check
  CHECK (provider IN ('canva', 'tiktok_shop'));