CREATE TABLE public.creator_lead_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX creator_lead_rate_limits_ip_time_idx
  ON public.creator_lead_rate_limits (ip_hash, created_at DESC);

GRANT SELECT ON public.creator_lead_rate_limits TO authenticated;
GRANT ALL ON public.creator_lead_rate_limits TO service_role;

ALTER TABLE public.creator_lead_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view creator lead rate limits"
  ON public.creator_lead_rate_limits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.check_creator_lead_rate_limit(_ip_hash text, _max_per_hour integer DEFAULT 5)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent integer;
BEGIN
  IF _ip_hash IS NULL OR length(_ip_hash) < 8 THEN
    RETURN false;
  END IF;

  DELETE FROM public.creator_lead_rate_limits
  WHERE created_at < now() - interval '24 hours';

  SELECT count(*) INTO recent
  FROM public.creator_lead_rate_limits
  WHERE ip_hash = _ip_hash
    AND created_at > now() - interval '1 hour';

  IF recent >= greatest(_max_per_hour, 1) THEN
    RETURN false;
  END IF;

  INSERT INTO public.creator_lead_rate_limits (ip_hash) VALUES (_ip_hash);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_creator_lead_rate_limit(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_creator_lead_rate_limit(text, integer) TO anon, authenticated, service_role;