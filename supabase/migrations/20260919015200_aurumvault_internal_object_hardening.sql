-- Independent staging least-privilege hardening for internal-only objects.

-- This function is an auth trigger target, not a public RPC.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Billing events are webhook/service audit records. RLS already has no client
-- policies; remove broad client table privileges as defense in depth.
REVOKE ALL ON TABLE public.license_wallet_billing_events FROM anon;
REVOKE ALL ON TABLE public.license_wallet_billing_events FROM authenticated;
GRANT ALL ON TABLE public.license_wallet_billing_events TO service_role;
