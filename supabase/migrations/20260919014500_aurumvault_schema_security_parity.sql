-- AurumVault staging parity hardening.
-- Align the remaining weaker staging RLS policies with the recovered production
-- behavior while preserving intentional least-privilege deltas elsewhere.

-- Affiliate referral clicks must reference an active affiliate code. When a
-- product is supplied, that product must belong to the creator for the code.
DROP POLICY IF EXISTS "Anyone can log a click" ON public.affiliate_referral_clicks;
CREATE POLICY "Anyone can log a click"
ON public.affiliate_referral_clicks
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.creator_affiliates ca
    WHERE ca.referral_code = affiliate_referral_clicks.referral_code
      AND ca.status = 'active'
  )
  AND (
    product_id IS NULL
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

-- Follower rows are private to either side of the relationship. Public follower
-- counts remain available through the dedicated count RPC.
DROP POLICY IF EXISTS "Anyone can read followers" ON public.creator_followers;
DROP POLICY IF EXISTS "Users read own follow rows" ON public.creator_followers;
CREATE POLICY "Users read own follow rows"
ON public.creator_followers
FOR SELECT
TO authenticated
USING (auth.uid() = follower_id OR auth.uid() = creator_user_id);

-- Askers may edit only unanswered questions and may not write answer metadata.
DROP POLICY IF EXISTS "Asker can update own" ON public.product_qa;
DROP POLICY IF EXISTS "Asker can update own unanswered question" ON public.product_qa;
CREATE POLICY "Asker can update own unanswered question"
ON public.product_qa
FOR UPDATE
TO authenticated
USING (
  auth.uid() = asker_user_id
  AND answer IS NULL
  AND answered_by_admin = false
)
WITH CHECK (
  auth.uid() = asker_user_id
  AND answer IS NULL
  AND answered_by_admin = false
  AND answerer_user_id IS NULL
  AND answerer_name IS NULL
  AND answered_at IS NULL
);

-- Self-service applications must begin pending; applicants cannot self-create
-- pre-approved or review-state records.
DROP POLICY IF EXISTS "apps_self_insert" ON public.seller_applications;
CREATE POLICY "apps_self_insert"
ON public.seller_applications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'::public.application_status
);

-- Public variant discovery is anonymous-only, matching the recovered production
-- contract. Authenticated owners/admins retain their separate policies.
DROP POLICY IF EXISTS "Public can view active variants of published products" ON public.product_variants;
CREATE POLICY "Public can view active variants of published products"
ON public.product_variants
FOR SELECT
TO anon
USING (
  is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.marketplace_products p
    WHERE p.id = product_variants.product_id
      AND p.published = true
      AND p.status = 'approved'::public.product_status
  )
);
