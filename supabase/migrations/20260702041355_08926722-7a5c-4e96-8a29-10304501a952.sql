
CREATE TABLE public.product_publish_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  event text NOT NULL,
  from_published boolean,
  to_published boolean,
  from_status text,
  to_status text,
  actor_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_publish_history TO authenticated;
GRANT ALL ON public.product_publish_history TO service_role;

ALTER TABLE public.product_publish_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers view own product history"
  ON public.product_publish_history FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_pph_product_created ON public.product_publish_history(product_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_marketplace_publish_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.product_publish_history
      (product_id, seller_id, event, from_published, to_published, from_status, to_status, actor_id)
    VALUES
      (NEW.id, NEW.seller_id, 'created', NULL, NEW.published, NULL, NEW.status::text, auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.published IS DISTINCT FROM OLD.published OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event := CASE NEW.status::text
        WHEN 'approved' THEN 'approved'
        WHEN 'rejected' THEN 'rejected'
        WHEN 'pending' THEN 'submitted'
        ELSE 'status_changed'
      END;
    ELSIF NEW.published AND NOT COALESCE(OLD.published, false) THEN
      v_event := 'republished';
    ELSIF COALESCE(OLD.published, false) AND NOT NEW.published THEN
      v_event := 'unpublished';
    ELSE
      v_event := 'updated';
    END IF;

    INSERT INTO public.product_publish_history
      (product_id, seller_id, event, from_published, to_published, from_status, to_status, actor_id)
    VALUES
      (NEW.id, NEW.seller_id, v_event, OLD.published, NEW.published, OLD.status::text, NEW.status::text, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_publish_change ON public.marketplace_products;
CREATE TRIGGER trg_log_publish_change
AFTER INSERT OR UPDATE OF published, status ON public.marketplace_products
FOR EACH ROW EXECUTE FUNCTION public.log_marketplace_publish_change();

-- Backfill initial "created" entry for existing products so history isn't empty
INSERT INTO public.product_publish_history
  (product_id, seller_id, event, from_published, to_published, from_status, to_status, actor_id, created_at)
SELECT id, seller_id, 'created', NULL, published, NULL, status::text, seller_id, created_at
FROM public.marketplace_products
ON CONFLICT DO NOTHING;
