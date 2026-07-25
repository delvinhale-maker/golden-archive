
-- Guard: creators cannot modify anything but status on affiliate_commissions
DROP TRIGGER IF EXISTS trg_affiliate_commissions_guard_update ON public.affiliate_commissions;
CREATE TRIGGER trg_affiliate_commissions_guard_update
BEFORE UPDATE ON public.affiliate_commissions
FOR EACH ROW
EXECUTE FUNCTION public.affiliate_commissions_guard_creator_update();

-- Guard: creators cannot modify anything but status on creator_affiliates
CREATE OR REPLACE FUNCTION public.creator_affiliates_guard_creator_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.affiliate_user_id IS DISTINCT FROM OLD.affiliate_user_id
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Creators can only update status on creator_affiliates';
  END IF;

  -- Prevent reactivating a banned affiliate: once status is 'banned', it stays.
  IF OLD.status = 'banned' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Banned affiliates cannot be reactivated by creators';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_creator_affiliates_guard_update ON public.creator_affiliates;
CREATE TRIGGER trg_creator_affiliates_guard_update
BEFORE UPDATE ON public.creator_affiliates
FOR EACH ROW
EXECUTE FUNCTION public.creator_affiliates_guard_creator_update();
