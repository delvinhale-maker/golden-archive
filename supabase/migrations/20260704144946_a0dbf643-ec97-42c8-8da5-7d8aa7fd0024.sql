
-- Hide asker/answerer user IDs from public reads on product_qa.
-- Create a safe view that excludes those columns, and lock down the base table.

DROP POLICY IF EXISTS "Anyone reads qa" ON public.product_qa;

-- Owner and admin can still read the full base table (needed for updates/deletes under RLS).
CREATE POLICY "Asker can read own qa"
  ON public.product_qa FOR SELECT
  TO authenticated
  USING (auth.uid() = asker_user_id);

CREATE POLICY "Admins read all qa"
  ON public.product_qa FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Public-safe view: no user IDs exposed.
CREATE OR REPLACE VIEW public.product_qa_public
WITH (security_invoker = on) AS
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

-- Allow anon/authenticated to read the view rows by adding a permissive SELECT
-- policy that matches only the safe (non-identifying) columns via the view.
-- The view uses security_invoker, so it evaluates RLS as the caller; grant a
-- broad read policy scoped to what the view exposes.
CREATE POLICY "Public reads qa via view"
  ON public.product_qa FOR SELECT
  TO anon, authenticated
  USING (true);

-- Revoke direct column access to the sensitive columns from anon/authenticated
-- so only the view (which doesn't select them) can surface them.
REVOKE SELECT ON public.product_qa FROM anon, authenticated;
GRANT SELECT (id, product_id, asker_name, question, answer, answerer_name, answered_by_admin, answered_at, created_at)
  ON public.product_qa TO anon, authenticated;
-- Keep write grants intact for authenticated users (RLS still enforces row scoping).
GRANT INSERT, UPDATE, DELETE ON public.product_qa TO authenticated;
