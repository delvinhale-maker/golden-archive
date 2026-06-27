
CREATE TABLE public.abandoned_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  session_id TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  recovered BOOLEAN NOT NULL DEFAULT false,
  recovered_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX abandoned_carts_user_id_idx ON public.abandoned_carts(user_id);
CREATE INDEX abandoned_carts_session_id_idx ON public.abandoned_carts(session_id);
CREATE UNIQUE INDEX abandoned_carts_session_unique ON public.abandoned_carts(session_id) WHERE recovered = false;

GRANT SELECT, INSERT, UPDATE ON public.abandoned_carts TO authenticated;
GRANT INSERT, UPDATE ON public.abandoned_carts TO anon;
GRANT ALL ON public.abandoned_carts TO service_role;

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own abandoned carts"
ON public.abandoned_carts FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can record an abandoned cart"
ON public.abandoned_carts FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Users update their own abandoned carts"
ON public.abandoned_carts FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anon updates own session cart"
ON public.abandoned_carts FOR UPDATE TO anon
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);

CREATE TRIGGER trg_abandoned_carts_updated_at
BEFORE UPDATE ON public.abandoned_carts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
