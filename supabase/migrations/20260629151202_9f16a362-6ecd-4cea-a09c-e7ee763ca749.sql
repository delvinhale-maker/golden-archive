
-- =========================================================
-- Fix 1: abandoned_carts — remove permissive anon UPDATE
-- =========================================================

DROP POLICY IF EXISTS "Anon updates own session cart" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Users update their own abandoned carts" ON public.abandoned_carts;

-- Authenticated users may still update only their own (real user_id) carts via PostgREST.
CREATE POLICY "Users update their own abandoned carts"
  ON public.abandoned_carts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- SECURITY DEFINER RPC for anonymous + authenticated session-scoped upserts.
CREATE OR REPLACE FUNCTION public.upsert_abandoned_cart(
  _session_id text,
  _items jsonb,
  _subtotal numeric,
  _item_count integer,
  _email text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _session_id IS NULL OR length(_session_id) < 8 THEN
    RAISE EXCEPTION 'invalid session_id';
  END IF;

  INSERT INTO public.abandoned_carts AS ac
    (session_id, user_id, email, items, subtotal, item_count, recovered)
  VALUES
    (_session_id, _uid, _email, COALESCE(_items, '[]'::jsonb),
     COALESCE(_subtotal, 0), COALESCE(_item_count, 0), false)
  ON CONFLICT (session_id) WHERE recovered = false
  DO UPDATE SET
    items = EXCLUDED.items,
    subtotal = EXCLUDED.subtotal,
    item_count = EXCLUDED.item_count,
    email = COALESCE(EXCLUDED.email, ac.email),
    user_id = COALESCE(EXCLUDED.user_id, ac.user_id),
    updated_at = now()
  WHERE
    -- Authenticated callers can only touch their own row OR an anon row.
    (_uid IS NULL AND ac.user_id IS NULL)
    OR (_uid IS NOT NULL AND (ac.user_id = _uid OR ac.user_id IS NULL));
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_abandoned_cart(text, jsonb, numeric, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_abandoned_cart(text, jsonb, numeric, integer, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_abandoned_cart_recovered(_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _session_id IS NULL OR length(_session_id) < 8 THEN
    RETURN;
  END IF;
  UPDATE public.abandoned_carts
     SET recovered = true,
         recovered_at = now()
   WHERE session_id = _session_id
     AND recovered = false
     AND (
       (_uid IS NULL AND user_id IS NULL)
       OR (_uid IS NOT NULL AND (user_id = _uid OR user_id IS NULL))
     );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_abandoned_cart_recovered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_abandoned_cart_recovered(text) TO anon, authenticated;

-- =========================================================
-- Fix 2: marketplace_products — column-scoped anon SELECT
-- =========================================================

-- Revoke broad SELECT from anon, then grant only safe display columns.
REVOKE SELECT ON public.marketplace_products FROM anon;

GRANT SELECT
  (id, title, subtitle, description, category, price_cents,
   compare_at_price_cents, cover_url, seller_id, creator_name,
   language, status, published, approved_at, created_at,
   ai_review_status, ai_review_score, ai_review_blurb,
   ai_review_seo_title, ai_review_tags)
  ON public.marketplace_products TO anon;

-- Authenticated keeps full table access (RLS still scopes to own rows / admin role).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_products TO authenticated;
GRANT ALL ON public.marketplace_products TO service_role;
