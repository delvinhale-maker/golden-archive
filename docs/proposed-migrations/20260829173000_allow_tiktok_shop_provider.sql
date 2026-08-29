-- AurumVault: allow the 'tiktok_shop' provider on the EXISTING integration
-- connections table. PROPOSED ONLY — NOT APPLIED.
--
-- WHY A MIGRATION IS REQUIRED
--   public.integration_connections.provider currently carries:
--     CHECK ((provider = 'canva'::text))
--   so any TikTok Shop row is rejected by the database. This is the ONLY schema
--   change TikTok Shop needs: the table's columns, indexes, grants, RLS policies
--   and owner-guard trigger are already provider-agnostic and are reused as-is.
--
-- SCOPE / SAFETY
--   Additive and non-destructive: no DROP TABLE, no TRUNCATE, no DELETE, no
--   column change, no grant change, no RLS/policy change. Existing Canva rows
--   continue to satisfy the widened constraint unchanged.
--
-- ROLLBACK
--   ALTER TABLE public.integration_connections
--     DROP CONSTRAINT integration_connections_provider_check;
--   ALTER TABLE public.integration_connections
--     ADD CONSTRAINT integration_connections_provider_check
--     CHECK (provider = 'canva');
--   (safe only once no tiktok_shop rows exist)

ALTER TABLE public.integration_connections
  DROP CONSTRAINT IF EXISTS integration_connections_provider_check;

ALTER TABLE public.integration_connections
  ADD CONSTRAINT integration_connections_provider_check
  CHECK (provider IN ('canva', 'tiktok_shop'));
