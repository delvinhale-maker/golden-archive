CREATE OR REPLACE FUNCTION public.affiliate_commissions_guard_creator_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
BEGIN
  -- Admins bypass the guard entirely.
  SELECT COALESCE(public.has_role(auth.uid(), 'admin'), false) INTO _is_admin;
  IF _is_admin THEN
    RETURN NEW;
  END IF;

  -- The existing UPDATE policy already restricts the row to the creator;
  -- this guard ensures the creator can ONLY change status.
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
    RAISE EXCEPTION 'Creators can only update status on affiliate_commissions';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop the trigger if it already exists so the migration is idempotent.
DROP TRIGGER IF EXISTS affiliate_commissions_guard_creator_update ON public.affiliate_commissions;

CREATE TRIGGER affiliate_commissions_guard_creator_update
BEFORE UPDATE ON public.affiliate_commissions
FOR EACH ROW
EXECUTE FUNCTION public.affiliate_commissions_guard_creator_update();