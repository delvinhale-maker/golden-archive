ALTER TABLE public.creator_payout_methods
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'weekly';

ALTER TABLE public.creator_payout_methods
  DROP CONSTRAINT IF EXISTS creator_payout_methods_frequency_check;

ALTER TABLE public.creator_payout_methods
  ADD CONSTRAINT creator_payout_methods_frequency_check
  CHECK (frequency IN ('weekly','monthly'));