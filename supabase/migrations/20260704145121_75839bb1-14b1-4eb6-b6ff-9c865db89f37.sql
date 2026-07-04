
DROP VIEW IF EXISTS public.product_qa_public;

CREATE OR REPLACE FUNCTION public.list_product_qa(_product_id uuid)
RETURNS TABLE (
  id uuid,
  product_id uuid,
  asker_name text,
  question text,
  answer text,
  answerer_name text,
  answered_by_admin boolean,
  answered_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    q.id,
    q.product_id,
    q.asker_name,
    q.question,
    q.answer,
    q.answerer_name,
    q.answered_by_admin,
    q.answered_at,
    q.created_at
  FROM public.product_qa q
  WHERE q.product_id = _product_id
  ORDER BY q.answered_at DESC NULLS LAST, q.created_at DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.list_product_qa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_product_qa(uuid) TO anon, authenticated;
