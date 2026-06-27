
CREATE TABLE public.subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'homepage_banner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscribers_email_lower_idx ON public.subscribers (lower(email));

GRANT INSERT ON public.subscribers TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.subscribers TO authenticated;
GRANT ALL ON public.subscribers TO service_role;

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
  ON public.subscribers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view subscribers"
  ON public.subscribers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage subscribers"
  ON public.subscribers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
