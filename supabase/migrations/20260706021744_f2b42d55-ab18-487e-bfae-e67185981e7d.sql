CREATE OR REPLACE FUNCTION public.request_payout(_amount_cents bigint, _note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _pending bigint;
  _currency text;
  _snapshot jsonb;
  _req_id uuid;
  _open int;
  _has_tax int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _amount_cents IS NULL OR _amount_cents < 2500 THEN
    RAISE EXCEPTION 'minimum payout is $25';
  END IF;

  SELECT count(*) INTO _open FROM public.payout_requests
   WHERE seller_id = _uid AND status IN ('pending','approved');
  IF _open > 0 THEN RAISE EXCEPTION 'you already have an open payout request'; END IF;

  SELECT count(*) INTO _has_tax FROM public.creator_tax_forms
   WHERE seller_id = _uid AND status <> 'rejected';
  IF _has_tax = 0 THEN
    RAISE EXCEPTION 'submit a W-9 or W-8BEN tax form before requesting payouts';
  END IF;

  SELECT pending_cents, currency INTO _pending, _currency
    FROM public.seller_balances WHERE seller_id = _uid FOR UPDATE;
  IF _pending IS NULL THEN RAISE EXCEPTION 'no balance found'; END IF;
  IF _amount_cents > _pending THEN
    RAISE EXCEPTION 'requested amount exceeds pending balance';
  END IF;

  SELECT to_jsonb(m) - 'created_at' - 'updated_at'
    INTO _snapshot
    FROM public.creator_payout_methods m WHERE seller_id = _uid;
  IF _snapshot IS NULL THEN
    RAISE EXCEPTION 'add a payout method before requesting';
  END IF;

  INSERT INTO public.payout_requests(seller_id, amount_cents, currency, seller_note, method_snapshot)
  VALUES (_uid, _amount_cents, COALESCE(_currency,'usd'), _note, _snapshot)
  RETURNING id INTO _req_id;

  INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
  SELECT ur.user_id, 'payout_request', 'New payout request',
         format('Creator requested $%.2f', (_amount_cents/100.0)),
         '/admin/payouts',
         jsonb_build_object('request_id', _req_id, 'seller_id', _uid, 'amount_cents', _amount_cents)
    FROM public.user_roles ur WHERE ur.role = 'admin';

  RETURN _req_id;
END $function$;