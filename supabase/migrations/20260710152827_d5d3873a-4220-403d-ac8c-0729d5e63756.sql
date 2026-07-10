
-- Authenticated-only RPCs (require auth.uid())
REVOKE EXECUTE ON FUNCTION public.record_creator_referral(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.request_payout(bigint, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_creator_referral_stats() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_decide_payout_request(uuid, boolean, text, text, boolean) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_record_seller_payout(uuid, bigint, text, text) FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.record_creator_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payout(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_creator_referral_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_payout_request(uuid, boolean, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_seller_payout(uuid, bigint, text, text) TO authenticated;

-- Trigger/internal functions: only postgres/service_role should call directly
REVOKE EXECUTE ON FUNCTION public.bump_forum_like_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.bump_forum_reply_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_marketplace_publish_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.bump_review_helpful() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.run_slug_integrity_check() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;

-- has_role stays callable so RLS policies work as invoker; keep it as-is.
-- Public/anon-eligible RPCs stay: list_product_qa, get_creator_follower_count,
-- confirm_subscriber, upsert_abandoned_cart, mark_abandoned_cart_recovered, has_role.
