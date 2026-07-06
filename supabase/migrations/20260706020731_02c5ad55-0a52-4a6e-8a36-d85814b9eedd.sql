-- tax-forms bucket policies. Files must be prefixed with the seller's uuid.
CREATE POLICY "Sellers upload own tax forms"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tax-forms'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Sellers read own tax forms"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tax-forms'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(),'admin')
    )
  );

CREATE POLICY "Sellers replace own tax forms"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tax-forms'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Sellers delete own tax forms"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tax-forms'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );