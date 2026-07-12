-- Fix guard function to use actual column name commission_rate_pct
CREATE OR REPLACE FUNCTION public.affiliate_commissions_guard_creator_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.affiliate_user_id IS DISTINCT FROM OLD.affiliate_user_id
     OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.order_item_id IS DISTINCT FROM OLD.order_item_id
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.commission_cents IS DISTINCT FROM OLD.commission_cents
     OR NEW.sale_amount_cents IS DISTINCT FROM OLD.sale_amount_cents
     OR NEW.commission_rate_pct IS DISTINCT FROM OLD.commission_rate_pct
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Creators can only update status on affiliate commissions';
  END IF;

  RETURN NEW;
END;
$function$;

-- Tighten referral-click INSERT: require active affiliate; product (if given) must belong to same creator's approved published catalog
DROP POLICY IF EXISTS "Anyone can log a click" ON public.affiliate_referral_clicks;

CREATE POLICY "Anyone can log a click"
ON public.affiliate_referral_clicks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.creator_affiliates ca
    WHERE ca.referral_code = affiliate_referral_clicks.referral_code
      AND ca.status = 'active'
  )
  AND (
    affiliate_referral_clicks.product_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.marketplace_products mp
      JOIN public.creator_affiliates ca2
        ON ca2.creator_id = mp.seller_id
      WHERE mp.id = affiliate_referral_clicks.product_id
        AND ca2.referral_code = affiliate_referral_clicks.referral_code
        AND ca2.status = 'active'
    )
  )
);