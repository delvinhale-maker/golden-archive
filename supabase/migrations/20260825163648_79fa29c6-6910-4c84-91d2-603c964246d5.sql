-- Trigger functions are invoked by the database, never by API callers, so
-- no app role needs EXECUTE on them.
REVOKE ALL ON FUNCTION public.qr_campaigns_guard_identity() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.qr_projects_guard_campaign_owner() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.qr_projects_guard_identity() FROM anon, authenticated;