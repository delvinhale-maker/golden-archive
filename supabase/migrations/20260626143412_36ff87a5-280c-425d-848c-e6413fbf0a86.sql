
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_email text NOT NULL,
  stripe_session_id text UNIQUE,
  stripe_payment_intent text,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending',
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL,
  product_title text NOT NULL,
  unit_amount_cents integer NOT NULL,
  platform_fee_cents integer NOT NULL,
  seller_amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_order_items_seller ON public.order_items(seller_id);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  max_downloads integer NOT NULL DEFAULT 5,
  download_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_downloads_token ON public.order_downloads(token);
GRANT ALL ON public.order_downloads TO service_role;
ALTER TABLE public.order_downloads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.seller_balances (
  seller_id uuid PRIMARY KEY,
  pending_cents bigint NOT NULL DEFAULT 0,
  paid_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_balances TO authenticated;
GRANT ALL ON public.seller_balances TO service_role;
ALTER TABLE public.seller_balances ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER seller_balances_updated BEFORE UPDATE ON public.seller_balances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Admins view all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sellers view orders containing their products" ON public.orders
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = orders.id AND oi.seller_id = auth.uid()));

CREATE POLICY "Admins view all order items" ON public.order_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sellers view their own order items" ON public.order_items
  FOR SELECT TO authenticated USING (seller_id = auth.uid());

CREATE POLICY "Sellers view their own balance" ON public.seller_balances
  FOR SELECT TO authenticated USING (seller_id = auth.uid());
CREATE POLICY "Admins view all balances" ON public.seller_balances
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
