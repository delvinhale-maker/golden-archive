
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  source TEXT,
  first_order_id UUID,
  first_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id)
);

CREATE INDEX referrals_referrer_idx ON public.referrals(referrer_user_id);
CREATE INDEX referrals_code_idx ON public.referrals(referral_code);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

CREATE TRIGGER referrals_touch_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS referrer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_referrer_idx ON public.orders(referrer_user_id);
