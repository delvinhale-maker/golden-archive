-- Add photo support to product reviews
ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS photo_url text;

-- Q&A table
CREATE TABLE IF NOT EXISTS public.product_qa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  asker_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  asker_name text NOT NULL,
  question text NOT NULL CHECK (length(question) BETWEEN 4 AND 1000),
  answer text,
  answerer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  answerer_name text,
  answered_by_admin boolean NOT NULL DEFAULT false,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_qa_product_idx ON public.product_qa (product_id, created_at DESC);

GRANT SELECT ON public.product_qa TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_qa TO authenticated;
GRANT ALL ON public.product_qa TO service_role;

ALTER TABLE public.product_qa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads qa" ON public.product_qa FOR SELECT USING (true);
CREATE POLICY "Auth can ask" ON public.product_qa FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = asker_user_id);
CREATE POLICY "Asker can update own" ON public.product_qa FOR UPDATE TO authenticated
  USING (auth.uid() = asker_user_id) WITH CHECK (auth.uid() = asker_user_id);
CREATE POLICY "Asker or admin can delete" ON public.product_qa FOR DELETE TO authenticated
  USING (auth.uid() = asker_user_id OR public.has_role(auth.uid(), 'admin'));
-- Admins can answer (update) any row via security-definer function below
CREATE POLICY "Admins update any" ON public.product_qa FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER product_qa_touch BEFORE UPDATE ON public.product_qa
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();