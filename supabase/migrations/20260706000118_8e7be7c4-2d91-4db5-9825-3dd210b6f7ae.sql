
-- =========================================================
-- Creator affiliate programs
-- =========================================================
CREATE TABLE public.creator_affiliate_programs (
  creator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  commission_rate_pct numeric(5,2) NOT NULL DEFAULT 20.00
    CHECK (commission_rate_pct >= 1 AND commission_rate_pct <= 50),
  terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_affiliate_programs TO authenticated;
GRANT SELECT ON public.creator_affiliate_programs TO anon;
GRANT ALL ON public.creator_affiliate_programs TO service_role;

ALTER TABLE public.creator_affiliate_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view enabled programs"
  ON public.creator_affiliate_programs FOR SELECT
  USING (enabled = true OR auth.uid() = creator_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creator manages own program"
  ON public.creator_affiliate_programs FOR ALL
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Admin manages all programs"
  ON public.creator_affiliate_programs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER creator_affiliate_programs_touch
  BEFORE UPDATE ON public.creator_affiliate_programs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Creator affiliates (one per creator+promoter pair)
-- =========================================================
CREATE TABLE public.creator_affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(creator_id, affiliate_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_affiliates TO authenticated;
GRANT ALL ON public.creator_affiliates TO service_role;

ALTER TABLE public.creator_affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creator views their affiliates"
  ON public.creator_affiliates FOR SELECT
  TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY "Affiliate views own rows"
  ON public.creator_affiliates FOR SELECT
  TO authenticated
  USING (auth.uid() = affiliate_user_id);

CREATE POLICY "Admin views all affiliates"
  ON public.creator_affiliates FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- User can join a creator's enabled program as themselves
CREATE POLICY "User joins as themselves"
  ON public.creator_affiliates FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = affiliate_user_id
    AND EXISTS (
      SELECT 1 FROM public.creator_affiliate_programs p
      WHERE p.creator_id = creator_affiliates.creator_id AND p.enabled = true
    )
  );

CREATE POLICY "Creator can update/disable their affiliates"
  ON public.creator_affiliates FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE INDEX creator_affiliates_creator_idx ON public.creator_affiliates(creator_id);
CREATE INDEX creator_affiliates_affiliate_idx ON public.creator_affiliates(affiliate_user_id);
CREATE INDEX creator_affiliates_code_idx ON public.creator_affiliates(referral_code);

-- =========================================================
-- Affiliate referral clicks
-- =========================================================
CREATE TABLE public.affiliate_referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL,
  product_id uuid REFERENCES public.marketplace_products(id) ON DELETE SET NULL,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text
);

GRANT SELECT, INSERT ON public.affiliate_referral_clicks TO authenticated;
GRANT INSERT ON public.affiliate_referral_clicks TO anon;
GRANT ALL ON public.affiliate_referral_clicks TO service_role;

ALTER TABLE public.affiliate_referral_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone can log a click for an existing referral code
CREATE POLICY "Anyone can log a click"
  ON public.affiliate_referral_clicks FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.creator_affiliates ca WHERE ca.referral_code = affiliate_referral_clicks.referral_code)
  );

CREATE POLICY "Creator views clicks for own codes"
  ON public.affiliate_referral_clicks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_affiliates ca
      WHERE ca.referral_code = affiliate_referral_clicks.referral_code
        AND ca.creator_id = auth.uid()
    )
  );

CREATE POLICY "Affiliate views own clicks"
  ON public.affiliate_referral_clicks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_affiliates ca
      WHERE ca.referral_code = affiliate_referral_clicks.referral_code
        AND ca.affiliate_user_id = auth.uid()
    )
  );

CREATE POLICY "Admin views all clicks"
  ON public.affiliate_referral_clicks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX affiliate_clicks_code_idx ON public.affiliate_referral_clicks(referral_code, clicked_at DESC);

-- =========================================================
-- Affiliate commissions
-- =========================================================
CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  sale_amount_cents integer NOT NULL CHECK (sale_amount_cents >= 0),
  commission_rate_pct numeric(5,2) NOT NULL,
  commission_cents integer NOT NULL CHECK (commission_cents >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_item_id)
);

GRANT SELECT, UPDATE ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creator views own commissions"
  ON public.affiliate_commissions FOR SELECT
  TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY "Affiliate views earned commissions"
  ON public.affiliate_commissions FOR SELECT
  TO authenticated
  USING (auth.uid() = affiliate_user_id);

CREATE POLICY "Admin views all commissions"
  ON public.affiliate_commissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Creator can mark commissions as paid (or void) for their own products
CREATE POLICY "Creator marks own commissions paid"
  ON public.affiliate_commissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE INDEX affiliate_commissions_creator_idx ON public.affiliate_commissions(creator_id, status, created_at DESC);
CREATE INDEX affiliate_commissions_affiliate_idx ON public.affiliate_commissions(affiliate_user_id, created_at DESC);
