
CREATE TABLE public.cover_audit_runs (
  category TEXT PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ok BOOLEAN NOT NULL,
  total INT NOT NULL,
  passing INT NOT NULL,
  failing INT NOT NULL,
  results JSONB NOT NULL,
  failing_rows JSONB NOT NULL
);

GRANT SELECT ON public.cover_audit_runs TO authenticated;
GRANT ALL ON public.cover_audit_runs TO service_role;

ALTER TABLE public.cover_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read cover audit runs"
  ON public.cover_audit_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
