DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rights_passports','rights_passport_assets','rights_ai_consents','rights_licenses',
    'rights_evidence','rights_review_flags','rights_passport_documents',
    'rights_analysis_runs','rights_analysis_findings','rights_passport_snapshots'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_write', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), ''admin''))',
      t || '_owner_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), ''admin'')) WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), ''admin''))',
      t || '_owner_update', t);
    EXECUTE format('REVOKE DELETE, TRUNCATE ON public.%I FROM authenticated, anon', t);
  END LOOP;
END
$$;