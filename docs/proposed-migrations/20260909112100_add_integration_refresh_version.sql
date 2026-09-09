-- AurumVault integration refresh concurrency version (PROPOSED / STAGING-VALIDATED).
--
-- PURPOSE
--   Adds a monotonic, server-only version counter to public.integration_connections
--   for optimistic concurrency around rotating OAuth refresh tokens. PostgreSQL
--   now() is transaction-stable, so updated_at is not a safe CAS token when two
--   updates can occur inside one transaction/clock snapshot. refresh_version is
--   incremented on every UPDATE and is therefore the authoritative write version.
--
-- STATUS
--   Validated in the isolated aurumvault-staging backend only. NOT APPLIED TO
--   PRODUCTION by this repository change.
--
-- SECURITY
--   service_role may use the column. anon/authenticated receive no privilege on
--   refresh_version. Existing safe column-level SELECT grants remain unchanged.

ALTER TABLE public.integration_connections
  ADD COLUMN IF NOT EXISTS refresh_version BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_integration_refresh_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.refresh_version = OLD.refresh_version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_integration_connections_refresh_version
  ON public.integration_connections;

CREATE TRIGGER trg_integration_connections_refresh_version
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_integration_refresh_version();

REVOKE ALL (refresh_version) ON public.integration_connections FROM anon;
REVOKE ALL (refresh_version) ON public.integration_connections FROM authenticated;

COMMENT ON COLUMN public.integration_connections.refresh_version IS
  'Monotonic server-only CAS token for integration connection writes, including rotating OAuth token refresh.';
