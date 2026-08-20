ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS sequence_step2_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sequence_step3_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS subscribers_sequence_due_idx
  ON public.subscribers (status, confirmed_at);