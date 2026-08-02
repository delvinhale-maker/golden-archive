DROP POLICY "Public can view active variants of published products" ON public.product_variants;
CREATE POLICY "Public can view active variants of published products"
ON public.product_variants FOR SELECT TO anon
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.marketplace_products p
    WHERE p.id = product_variants.product_id
      AND p.published = true
      AND p.status = 'approved'::product_status
  )
);