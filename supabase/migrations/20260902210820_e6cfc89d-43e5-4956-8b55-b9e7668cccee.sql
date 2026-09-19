ALTER TABLE public.license_wallet_reminder_settings
  ADD COLUMN IF NOT EXISTS offsets integer[] NOT NULL DEFAULT '{30,21,7,1}'::integer[];