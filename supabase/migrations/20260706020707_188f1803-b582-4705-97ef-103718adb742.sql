-- Payout requests
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 2500),
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  method_snapshot jsonb,
  seller_note text,
  admin_note text,
  seller_payout_id uuid REFERENCES public.seller_payouts(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payout_requests_seller_idx ON public.payout_requests(seller_id, created_at DESC);
CREATE INDEX payout_requests_status_idx ON public.payout_requests(status, created_at DESC);

GRANT SELECT, INSERT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or admin" ON public.payout_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = seller_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Sellers insert own request" ON public.payout_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Admins update requests" ON public.payout_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER payout_requests_touch BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Creator payout methods
CREATE TABLE public.creator_payout_methods (
  seller_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('bank','paypal','wise','other')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_payout_methods TO authenticated;
GRANT ALL ON public.creator_payout_methods TO service_role;
ALTER TABLE public.creator_payout_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage own method" ON public.creator_payout_methods
  FOR ALL TO authenticated
  USING (auth.uid() = seller_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = seller_id);

CREATE TRIGGER creator_payout_methods_touch BEFORE UPDATE ON public.creator_payout_methods
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Creator tax forms
CREATE TABLE public.creator_tax_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_type text NOT NULL CHECK (form_type IN ('W9','W8BEN')),
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected')),
  admin_note text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX creator_tax_forms_seller_idx ON public.creator_tax_forms(seller_id, submitted_at DESC);

GRANT SELECT, INSERT ON public.creator_tax_forms TO authenticated;
GRANT ALL ON public.creator_tax_forms TO service_role;
ALTER TABLE public.creator_tax_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or admin tax forms" ON public.creator_tax_forms
  FOR SELECT TO authenticated
  USING (auth.uid() = seller_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Sellers submit tax forms" ON public.creator_tax_forms
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Admins review tax forms" ON public.creator_tax_forms
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER creator_tax_forms_touch BEFORE UPDATE ON public.creator_tax_forms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RPC: creator requests a payout ($25 min, one open at a time)
CREATE OR REPLACE FUNCTION public.request_payout(_amount_cents bigint, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _pending bigint;
  _currency text;
  _snapshot jsonb;
  _req_id uuid;
  _open int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _amount_cents IS NULL OR _amount_cents < 2500 THEN
    RAISE EXCEPTION 'minimum payout is $25';
  END IF;

  SELECT count(*) INTO _open FROM public.payout_requests
   WHERE seller_id = _uid AND status IN ('pending','approved');
  IF _open > 0 THEN RAISE EXCEPTION 'you already have an open payout request'; END IF;

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
END $$;
GRANT EXECUTE ON FUNCTION public.request_payout(bigint, text) TO authenticated;

-- RPC: admin approves / rejects / marks paid
CREATE OR REPLACE FUNCTION public.admin_decide_payout_request(
  _request_id uuid, _approve boolean, _method text DEFAULT NULL,
  _admin_note text DEFAULT NULL, _mark_paid boolean DEFAULT true
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _r public.payout_requests%ROWTYPE;
  _payout_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _r FROM public.payout_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'request already decided'; END IF;

  IF NOT _approve THEN
    UPDATE public.payout_requests
       SET status='rejected', admin_note=_admin_note,
           decided_by=auth.uid(), decided_at=now()
     WHERE id=_request_id;
    INSERT INTO public.notifications(user_id,type,title,body,link,metadata)
    VALUES (_r.seller_id,'payout_request','Payout request declined',
            COALESCE(_admin_note,'Your payout request was declined.'),
            '/dashboard/earnings',
            jsonb_build_object('request_id',_request_id));
    RETURN NULL;
  END IF;

  IF _mark_paid THEN
    _payout_id := public.admin_record_seller_payout(_r.seller_id, _r.amount_cents, _method, _admin_note);
    UPDATE public.payout_requests
       SET status='paid', admin_note=_admin_note, seller_payout_id=_payout_id,
           decided_by=auth.uid(), decided_at=now()
     WHERE id=_request_id;
  ELSE
    UPDATE public.payout_requests
       SET status='approved', admin_note=_admin_note,
           decided_by=auth.uid(), decided_at=now()
     WHERE id=_request_id;
  END IF;

  INSERT INTO public.notifications(user_id,type,title,body,link,metadata)
  VALUES (_r.seller_id,'payout_request',
          CASE WHEN _mark_paid THEN 'Payout sent' ELSE 'Payout approved' END,
          format('Your payout of $%.2f has been %s.', (_r.amount_cents/100.0),
                 CASE WHEN _mark_paid THEN 'sent' ELSE 'approved' END),
          '/dashboard/earnings',
          jsonb_build_object('request_id',_request_id,'seller_payout_id',_payout_id));
  RETURN _payout_id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_decide_payout_request(uuid, boolean, text, text, boolean) TO authenticated;