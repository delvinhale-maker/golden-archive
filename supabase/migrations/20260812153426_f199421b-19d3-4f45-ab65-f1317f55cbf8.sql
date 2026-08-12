ALTER TABLE public.creator_leads ADD COLUMN IF NOT EXISTS cta_source text;

CREATE TABLE IF NOT EXISTS public.cta_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  cta_location text NOT NULL,
  page_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.cta_click_events TO anon, authenticated;
GRANT ALL ON public.cta_click_events TO service_role;

ALTER TABLE public.cta_click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a CTA click"
  ON public.cta_click_events FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS cta_click_events_session_idx ON public.cta_click_events (session_id, created_at DESC);