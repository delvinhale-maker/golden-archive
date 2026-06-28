
CREATE TABLE public.auto_release_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('success','failure','no_op')),
  released_count INTEGER NOT NULL DEFAULT 0,
  released_ids UUID[] NOT NULL DEFAULT '{}',
  candidate_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  triggered_by TEXT NOT NULL DEFAULT 'cron',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auto_release_runs TO authenticated;
GRANT ALL ON public.auto_release_runs TO service_role;

ALTER TABLE public.auto_release_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view auto-release runs"
  ON public.auto_release_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX auto_release_runs_created_at_idx ON public.auto_release_runs (created_at DESC);
