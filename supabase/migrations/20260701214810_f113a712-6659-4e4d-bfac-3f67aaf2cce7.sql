
-- Case-insensitive unique title per seller for active listings
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_products_seller_title_unique
  ON public.marketplace_products (seller_id, lower(btrim(title)))
  WHERE status <> 'rejected';

-- Extend the existing slug integrity check to also flag duplicate titles
CREATE OR REPLACE FUNCTION public.run_slug_integrity_check()
 RETURNS slug_integrity_alerts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_missing int;
  v_dupes   int;
  v_title_dupes int;
  v_dupe_examples jsonb;
  v_title_dupe_examples jsonb;
  v_index   boolean;
  v_title_index boolean;
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

  WITH title_dupes AS (
    SELECT seller_id, lower(btrim(title)) AS norm_title, count(*) AS n
    FROM public.marketplace_products
    WHERE status <> 'rejected'
    GROUP BY seller_id, lower(btrim(title))
    HAVING count(*) > 1
  )
  SELECT count(*),
         COALESCE(jsonb_agg(jsonb_build_object(
           'seller_id', seller_id, 'title', norm_title, 'count', n
         )) FILTER (WHERE seller_id IS NOT NULL), '[]'::jsonb)
  INTO v_title_dupes, v_title_dupe_examples
  FROM title_dupes;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='marketplace_products'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(seller_id, slug)%'
      AND indexdef ILIKE '%status%rejected%'
  ) INTO v_index;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='marketplace_products'
      AND indexname = 'marketplace_products_seller_title_unique'
  ) INTO v_title_index;

  v_status := CASE
    WHEN NOT v_index OR NOT v_title_index OR v_dupes > 0 OR v_title_dupes > 0 THEN 'fail'
    WHEN v_missing > 0 THEN 'warn'
    ELSE 'ok'
  END;

  INSERT INTO public.slug_integrity_alerts
    (status, missing_slug_count, duplicate_group_count, index_present, details)
  VALUES
    (v_status, v_missing, v_dupes + v_title_dupes, v_index AND v_title_index,
     jsonb_build_object(
       'duplicates', v_dupe_examples,
       'title_duplicates', v_title_dupe_examples,
       'slug_index_present', v_index,
       'title_index_present', v_title_index
     ))
  RETURNING * INTO v_row;

  IF v_status <> 'ok' THEN
    FOR v_admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
      VALUES (
        v_admin.user_id,
        'slug_integrity',
        'Product integrity ' || v_status,
        format('Missing slugs: %s · Duplicate slug groups: %s · Duplicate title groups: %s · Indexes present: slug=%s title=%s',
               v_missing, v_dupes, v_title_dupes, v_index, v_title_index),
        '/admin',
        jsonb_build_object(
          'alert_id', v_row.id,
          'missing_slug_count', v_missing,
          'duplicate_slug_group_count', v_dupes,
          'duplicate_title_group_count', v_title_dupes,
          'slug_index_present', v_index,
          'title_index_present', v_title_index,
          'duplicates', v_dupe_examples,
          'title_duplicates', v_title_dupe_examples
        )
      );
    END LOOP;
  END IF;

  RETURN v_row;
END;
$function$;
