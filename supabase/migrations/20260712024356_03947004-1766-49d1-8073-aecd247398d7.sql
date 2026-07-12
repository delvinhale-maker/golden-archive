
CREATE POLICY "Vault finds images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'vault-finds');

CREATE POLICY "Admins can upload vault finds images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vault-finds' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update vault finds images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'vault-finds' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete vault finds images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vault-finds' AND public.has_role(auth.uid(), 'admin'));
