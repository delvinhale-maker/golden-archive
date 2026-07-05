
CREATE TABLE public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd',
  method text,
  note text,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_seller_payouts_seller ON public.seller_payouts(seller_id, paid_at DESC);

GRANT SELECT ON public.seller_payouts TO authenticated;
GRANT ALL ON public.seller_payouts TO service_role;

ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers view their own payouts"
  ON public.seller_payouts FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

CREATE POLICY "Admins view all payouts"
  ON public.seller_payouts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert payouts"
  ON public.seller_payouts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.admin_record_seller_payout(
  _seller_id uuid,
  _amount_cents bigint,
  _method text DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payout_id uuid;
  _current_pending bigint;
  _currency text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount_cents must be positive';
  END IF;

  SELECT pending_cents, currency
    INTO _current_pending, _currency
    FROM public.seller_balances
    WHERE seller_id = _seller_id
    FOR UPDATE;

  IF _current_pending IS NULL THEN
    RAISE EXCEPTION 'seller has no balance record';
  END IF;

  IF _amount_cents > _current_pending THEN
    RAISE EXCEPTION 'payout amount % exceeds pending balance %', _amount_cents, _current_pending;
  END IF;

  UPDATE public.seller_balances
     SET pending_cents = pending_cents - _amount_cents,
         paid_cents    = paid_cents + _amount_cents,
         updated_at    = now()
   WHERE seller_id = _seller_id;

  INSERT INTO public.seller_payouts (seller_id, amount_cents, currency, method, note, paid_by)
  VALUES (_seller_id, _amount_cents, COALESCE(_currency, 'usd'), _method, _note, auth.uid())
  RETURNING id INTO _payout_id;

  RETURN _payout_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_seller_payout(uuid, bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_seller_payout(uuid, bigint, text, text) TO authenticated;
