GRANT SELECT ON public.affiliate_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_products TO authenticated;
GRANT ALL ON public.affiliate_products TO service_role;