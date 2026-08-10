DELETE FROM public.creator_leads a
USING public.creator_leads b
WHERE a.email = b.email
  AND a.product_type = b.product_type
  AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

CREATE UNIQUE INDEX IF NOT EXISTS creator_leads_email_product_type_key
  ON public.creator_leads (email, product_type);