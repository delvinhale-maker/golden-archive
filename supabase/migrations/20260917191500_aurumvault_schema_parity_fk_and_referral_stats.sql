-- AurumVault Lovable-exit staging parity repair.
-- Applied first to independent staging only (ypelutaddlibqvpaekyq).
-- Do not apply to Lovable production as part of recovery.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.marketplace_products'::regclass
      AND conname = 'marketplace_products_primary_bundle_file_fk'
  ) THEN
    ALTER TABLE public.marketplace_products
      ADD CONSTRAINT marketplace_products_primary_bundle_file_fk
      FOREIGN KEY (primary_bundle_file_id)
      REFERENCES public.product_download_files(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Production's recovered implementation referenced order_items.unit_price_cents
-- and quantity, neither of which exists in the recovered production schema.
-- Use the actual snapshot field unit_amount_cents instead.
CREATE OR REPLACE FUNCTION public.get_creator_referral_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _referred_count integer := 0;
  _active_count integer := 0;
  _gmv_cents bigint := 0;
  _bonus_cents bigint := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object(
      'referred_count', 0,
      'active_count', 0,
      'gmv_cents', 0,
      'bonus_cents', 0
    );
  END IF;

  SELECT count(*) INTO _referred_count
  FROM public.creator_referrals
  WHERE referrer_user_id = _uid;

  SELECT count(*) INTO _active_count
  FROM public.creator_referrals
  WHERE referrer_user_id = _uid
    AND active
    AND expires_at > now();

  SELECT coalesce(sum(oi.unit_amount_cents), 0)::bigint
    INTO _gmv_cents
  FROM public.creator_referrals r
  JOIN public.order_items oi ON oi.seller_id = r.referred_user_id
  JOIN public.orders o ON o.id = oi.order_id
  WHERE r.referrer_user_id = _uid
    AND o.created_at BETWEEN r.created_at AND r.expires_at
    AND o.status IN ('paid', 'completed', 'fulfilled');

  _bonus_cents := floor(_gmv_cents * 0.05)::bigint;

  RETURN jsonb_build_object(
    'referred_count', _referred_count,
    'active_count', _active_count,
    'gmv_cents', _gmv_cents,
    'bonus_cents', _bonus_cents
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_creator_referral_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_referral_stats() TO authenticated, service_role;
