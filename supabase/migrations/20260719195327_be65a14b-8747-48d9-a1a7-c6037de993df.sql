
-- Prevent sellers from self-approving/publishing their own drafts.
-- Sellers may only save as 'draft' or submit as 'pending', and cannot set published=true.
-- Admins (and service_role) retain full control via products_admin_all.

DROP POLICY IF EXISTS products_seller_update_own ON public.marketplace_products;
DROP POLICY IF EXISTS products_seller_insert ON public.marketplace_products;

CREATE POLICY products_seller_insert
ON public.marketplace_products
FOR INSERT
TO authenticated
WITH CHECK (
  seller_id = auth.uid()
  AND status IN ('draft'::product_status, 'pending'::product_status)
  AND published = false
);

CREATE POLICY products_seller_update_own
ON public.marketplace_products
FOR UPDATE
TO authenticated
USING (
  seller_id = auth.uid()
  AND status = ANY (ARRAY['draft'::product_status, 'rejected'::product_status])
)
WITH CHECK (
  seller_id = auth.uid()
  AND status IN ('draft'::product_status, 'pending'::product_status)
  AND published = false
);
