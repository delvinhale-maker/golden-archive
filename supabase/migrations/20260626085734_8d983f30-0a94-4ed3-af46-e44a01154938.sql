GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_applications TO authenticated;
GRANT ALL ON public.seller_applications TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_products TO authenticated;
GRANT SELECT ON public.marketplace_products TO anon;
GRANT ALL ON public.marketplace_products TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;