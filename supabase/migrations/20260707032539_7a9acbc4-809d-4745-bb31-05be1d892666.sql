-- Fix ownership on the product-previews storage bucket.
-- Files must be stored under product-previews/<seller_id>/... so the seller
-- can only manage their own preview images. Admins retain full access.

DROP POLICY IF EXISTS "Authenticated users can upload product preview images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product preview images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product preview images" ON storage.objects;

-- Owners: first folder in the path must equal their auth uid.
CREATE POLICY "Owners can upload product preview images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-previews'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners can update product preview images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-previews'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'product-previews'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners can delete product preview images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-previews'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins: full access to the bucket for support/moderation.
CREATE POLICY "Admins can upload product preview images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-previews'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can update product preview images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-previews'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    bucket_id = 'product-previews'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete product preview images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-previews'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );