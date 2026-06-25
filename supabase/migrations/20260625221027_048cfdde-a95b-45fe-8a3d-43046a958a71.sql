
-- Covers: seller owns folder = their uid; signed-in users can read for now
CREATE POLICY "covers_seller_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "covers_seller_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "covers_seller_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "covers_authed_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-covers');
CREATE POLICY "covers_anon_read" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'product-covers');

-- Files: only owner can read/write; admins via service_role at checkout time
CREATE POLICY "files_seller_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "files_seller_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "files_seller_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "files_seller_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);
