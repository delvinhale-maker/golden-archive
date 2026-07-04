-- 1) Lock search_path on the 4 SECURITY DEFINER email-queue helpers (all use fully-qualified pgmq.* calls)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_catalog;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_catalog;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_catalog;

-- 2) Tighten SECURITY DEFINER execute grants.
-- Trigger and internal queue/cron helpers: revoke from PUBLIC/anon/authenticated
-- (postgres owner + service_role keep access; triggers and cron run as owner).
REVOKE EXECUTE ON FUNCTION public.bump_review_helpful() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_marketplace_publish_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;

-- has_role is only used by signed-in users and server code; revoke from anon.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Client RPCs that legitimately need anon access (public confirm link, guest cart tracking):
-- keep explicit grants so intent is clear.
GRANT EXECUTE ON FUNCTION public.confirm_subscriber(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_abandoned_cart(text, jsonb, numeric, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_abandoned_cart_recovered(text) TO anon, authenticated;

-- 3) Tighten the two always-true INSERT policies so users cannot spoof another user's id.
DROP POLICY IF EXISTS "Anyone can record an abandoned cart" ON public.abandoned_carts;
CREATE POLICY "Anyone can record an abandoned cart"
  ON public.abandoned_carts
  FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can log an affiliate click" ON public.affiliate_clicks;
CREATE POLICY "Anyone can log an affiliate click"
  ON public.affiliate_clicks
  FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());