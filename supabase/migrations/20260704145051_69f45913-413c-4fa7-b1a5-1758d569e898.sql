
-- Remove the base-table public SELECT policy; public reads must go through the view.
DROP POLICY IF EXISTS "Public reads qa via view" ON public.product_qa;

-- Revoke any direct table SELECT from anon/authenticated (column grants included).
REVOKE SELECT ON public.product_qa FROM anon, authenticated;

-- Recreate the view as a security_definer view (owned by postgres) so it can read
-- the base table on behalf of anon/authenticated without a permissive base RLS policy.
DROP VIEW IF EXISTS public.product_qa_public;
CREATE VIEW public.product_qa_public
WITH (security_invoker = off) AS
SELECT
  id,
  product_id,
  asker_name,
  question,
  answer,
  answerer_name,
  answered_by_admin,
  answered_at,
  created_at
FROM public.product_qa;

GRANT SELECT ON public.product_qa_public TO anon, authenticated;

-- Keep authenticated write grants (RLS still enforces row-level scoping).
GRANT INSERT, UPDATE, DELETE ON public.product_qa TO authenticated;
GRANT ALL ON public.product_qa TO service_role;
