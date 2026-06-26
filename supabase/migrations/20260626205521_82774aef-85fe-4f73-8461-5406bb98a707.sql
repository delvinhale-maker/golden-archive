
-- Backfill: existing approved products become live on the storefront
UPDATE public.marketplace_products SET published = true WHERE status = 'approved';

-- Update public read policy to require published = true
DROP POLICY IF EXISTS "products_public_approved_read" ON public.marketplace_products;
CREATE POLICY "products_public_published_read" ON public.marketplace_products
  FOR SELECT
  USING (status = 'approved' AND published = true);
