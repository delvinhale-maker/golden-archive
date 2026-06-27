
ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmation_token text,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

ALTER TABLE public.subscribers
  DROP CONSTRAINT IF EXISTS subscribers_status_check;
ALTER TABLE public.subscribers
  ADD CONSTRAINT subscribers_status_check CHECK (status IN ('pending','confirmed','unsubscribed'));

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_confirmation_token_idx
  ON public.subscribers(confirmation_token) WHERE confirmation_token IS NOT NULL;

-- Backfill existing rows as already confirmed (legacy single opt-in)
UPDATE public.subscribers SET status='confirmed', confirmed_at=COALESCE(confirmed_at, created_at)
WHERE status='pending' AND confirmation_token IS NULL AND confirmed_at IS NULL;

-- Remove direct anon INSERT capability; all signups must go through server route.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='subscribers' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.subscribers', pol.policyname);
  END LOOP;
END $$;

REVOKE INSERT, UPDATE, DELETE, SELECT ON public.subscribers FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscribers FROM authenticated;
GRANT SELECT ON public.subscribers TO authenticated;
GRANT ALL ON public.subscribers TO service_role;

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view subscribers"
  ON public.subscribers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Confirmation RPC: callable by anon, marks the matching pending row as confirmed.
CREATE OR REPLACE FUNCTION public.confirm_subscriber(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_email text;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;

  UPDATE public.subscribers
     SET status='confirmed',
         confirmed_at=now(),
         confirmation_token=NULL
   WHERE confirmation_token = _token
     AND status='pending'
   RETURNING email INTO row_email;

  IF row_email IS NULL THEN
    -- Could be already-confirmed: token would have been cleared
    IF EXISTS (SELECT 1 FROM public.subscribers WHERE confirmation_token IS NULL AND status='confirmed') THEN
      RETURN jsonb_build_object('ok', true, 'already', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  END IF;

  RETURN jsonb_build_object('ok', true, 'email', row_email);
END $$;

REVOKE ALL ON FUNCTION public.confirm_subscriber(text) FROM public;
GRANT EXECUTE ON FUNCTION public.confirm_subscriber(text) TO anon, authenticated;
