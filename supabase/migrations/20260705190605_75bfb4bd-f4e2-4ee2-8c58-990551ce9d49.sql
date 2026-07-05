CREATE TABLE public.payout_release_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  next_release_at timestamptz,
  eligible_seller_count integer NOT NULL DEFAULT 0,
  eligible_pending_cents bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  notes text,
  triggered_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payout_release_runs TO authenticated;
GRANT ALL ON public.payout_release_runs TO service_role;

ALTER TABLE public.payout_release_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view payout release runs"
  ON public.payout_release_runs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX payout_release_runs_ran_at_idx ON public.payout_release_runs (ran_at DESC);