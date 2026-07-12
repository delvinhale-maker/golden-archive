
CREATE OR REPLACE FUNCTION public.affiliate_commissions_guard_creator_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass this guard entirely
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.affiliate_user_id IS DISTINCT FROM OLD.affiliate_user_id
     OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.order_item_id IS DISTINCT FROM OLD.order_item_id
     OR NEW.commission_cents IS DISTINCT FROM OLD.commission_cents
     OR NEW.sale_amount_cents IS DISTINCT FROM OLD.sale_amount_cents
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Creators can only update status/paid_at on affiliate commissions';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS affiliate_commissions_guard_creator_update ON public.affiliate_commissions;
CREATE TRIGGER affiliate_commissions_guard_creator_update
BEFORE UPDATE ON public.affiliate_commissions
FOR EACH ROW
EXECUTE FUNCTION public.affiliate_commissions_guard_creator_update();
