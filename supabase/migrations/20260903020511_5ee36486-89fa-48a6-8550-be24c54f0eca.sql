ALTER TABLE public.license_wallet_entitlements
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS price_lookup_key text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox';

CREATE INDEX IF NOT EXISTS idx_wallet_ent_stripe_sub
  ON public.license_wallet_entitlements(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ent_stripe_cus
  ON public.license_wallet_entitlements(stripe_customer_id);

CREATE TABLE IF NOT EXISTS public.license_wallet_billing_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  processed_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.license_wallet_billing_events TO service_role;
ALTER TABLE public.license_wallet_billing_events ENABLE ROW LEVEL SECURITY;