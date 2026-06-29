
-- Slug integrity alerts: log table + daily check function + cron job

CREATE TABLE IF NOT EXISTS public.slug_integrity_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,                   -- 'ok' | 'warn' | 'fail'
  missing_slug_count int NOT NULL DEFAULT 0,
  duplicate_group_count int NOT NULL DEFAULT 0,
  index_present boolean NOT NULL DEFAULT true,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.slug_integrity_alerts TO authenticated;
GRANT ALL ON public.slug_integrity_alerts TO service_role;

ALTER TABLE public.slug_integrity_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read slug alerts" ON public.slug_integrity_alerts;
CREATE POLICY "Admins read slug alerts" ON public.slug_integrity_alerts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Check function: scans for risk, writes alert row + admin notifications when found.
CREATE OR REPLACE FUNCTION public.run_slug_integrity_check()
RETURNS public.slug_integrity_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_missing int;
  v_dupes   int;
  v_dupe_examples jsonb;
  v_index   boolean;
  v_status  text;
  v_row     public.slug_integrity_alerts;
  v_admin   record;
BEGIN
  SELECT count(*) INTO v_missing
  FROM public.marketplace_products
  WHERE slug IS NULL OR length(trim(slug)) = 0;

  WITH dupes AS (
    SELECT seller_id, slug, count(*) AS n
    FROM public.marketplace_products
    WHERE status <> 'rejected'
      AND slug IS NOT NULL AND length(trim(slug)) > 0
    GROUP BY seller_id, slug
    HAVING count(*) > 1
  )
  SELECT count(*),
         COALESCE(jsonb_agg(jsonb_build_object(
           'seller_id', seller_id, 'slug', slug, 'count', n
         )) FILTER (WHERE seller_id IS NOT NULL), '[]'::jsonb)
  INTO v_dupes, v_dupe_examples
  FROM dupes;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='marketplace_products'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(seller_id, slug)%'
      AND indexdef ILIKE '%status%rejected%'
  ) INTO v_index;

  v_status := CASE
    WHEN NOT v_index OR v_dupes > 0 THEN 'fail'
    WHEN v_missing > 0 THEN 'warn'
    ELSE 'ok'
  END;

  INSERT INTO public.slug_integrity_alerts
    (status, missing_slug_count, duplicate_group_count, index_present, details)
  VALUES
    (v_status, v_missing, v_dupes, v_index,
     jsonb_build_object('duplicates', v_dupe_examples))
  RETURNING * INTO v_row;

  -- Notify all admins on warn/fail
  IF v_status <> 'ok' THEN
    FOR v_admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
      VALUES (
        v_admin.user_id,
        'slug_integrity',
        'Slug integrity ' || v_status,
        format('Missing slugs: %s · Duplicate groups: %s · Unique index present: %s',
               v_missing, v_dupes, v_index),
        '/admin',
        jsonb_build_object(
          'alert_id', v_row.id,
          'missing_slug_count', v_missing,
          'duplicate_group_count', v_dupes,
          'index_present', v_index,
          'duplicates', v_dupe_examples
        )
      );
    END LOOP;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.run_slug_integrity_check() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_slug_integrity_check() TO service_role;

-- Schedule daily at 09:15 UTC
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'slug-integrity-daily';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'slug-integrity-daily',
  '15 9 * * *',
  $$ SELECT public.run_slug_integrity_check(); $$
);
