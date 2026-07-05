
CREATE POLICY "Admins can upload kingdom-picks images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kingdom-picks' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update kingdom-picks images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'kingdom-picks' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'kingdom-picks' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete kingdom-picks images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'kingdom-picks' AND public.has_role(auth.uid(), 'admin'::app_role));
