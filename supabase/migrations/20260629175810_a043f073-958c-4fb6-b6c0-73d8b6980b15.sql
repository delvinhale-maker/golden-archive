CREATE TABLE public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL CHECK (source IN ('client','server','boundary','unhandled_rejection','window_error')),
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('warn','error','fatal')),
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  user_id UUID,
  route TEXT,
  fingerprint TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  alerted_at TIMESTAMPTZ
);

CREATE INDEX idx_error_logs_occurred ON public.error_logs (occurred_at DESC);
CREATE INDEX idx_error_logs_fingerprint ON public.error_logs (fingerprint, occurred_at DESC);
CREATE INDEX idx_error_logs_severity ON public.error_logs (severity, occurred_at DESC);

GRANT SELECT ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read error logs"
  ON public.error_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
