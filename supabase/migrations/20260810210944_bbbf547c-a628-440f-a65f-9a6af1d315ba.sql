CREATE TABLE public.creator_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  product_type text NOT NULL,
  follower_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.creator_leads TO anon;
GRANT INSERT, SELECT ON public.creator_leads TO authenticated;
GRANT ALL ON public.creator_leads TO service_role;

ALTER TABLE public.creator_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a creator lead"
ON public.creator_leads FOR INSERT TO anon, authenticated
WITH CHECK (
  char_length(email) BETWEEN 3 AND 255
  AND char_length(product_type) BETWEEN 1 AND 60
  AND follower_count >= 0
  AND follower_count <= 100000000
);

CREATE POLICY "Admins can view creator leads"
ON public.creator_leads FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX creator_leads_created_at_idx ON public.creator_leads (created_at DESC);