CREATE TABLE public.product_download_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  label text NOT NULL,
  file_path text NOT NULL,
  file_size_bytes bigint,
  format text,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pdf_product ON public.product_download_files(product_id, sort_order);

GRANT SELECT ON public.product_download_files TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_download_files TO authenticated;
GRANT ALL ON public.product_download_files TO service_role;

ALTER TABLE public.product_download_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view delivery files of live products"
ON public.product_download_files FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.marketplace_products p
  WHERE p.id = product_id AND p.published = true AND p.status = 'approved'
));

CREATE POLICY "Sellers can view their own delivery files"
ON public.product_download_files FOR SELECT TO authenticated
USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can add delivery files to their products"
ON public.product_download_files FOR INSERT TO authenticated
WITH CHECK (
  (seller_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.marketplace_products p
    WHERE p.id = product_id AND p.seller_id = auth.uid()
  ))
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Sellers can update their delivery files"
ON public.product_download_files FOR UPDATE TO authenticated
USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can delete their delivery files"
ON public.product_download_files FOR DELETE TO authenticated
USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_pdf_updated_at
BEFORE UPDATE ON public.product_download_files
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();