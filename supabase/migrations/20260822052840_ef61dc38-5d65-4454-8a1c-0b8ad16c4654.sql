REVOKE ALL ON FUNCTION public.creator_leads_link_application() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.creator_leads_normalize() FROM anon, authenticated, public;

-- Starter Pack signups only collect a name + email, so the legacy recruitment
-- fields need safe defaults.
ALTER TABLE public.creator_leads
  ALTER COLUMN product_type SET DEFAULT 'unspecified',
  ALTER COLUMN follower_count SET DEFAULT 0;