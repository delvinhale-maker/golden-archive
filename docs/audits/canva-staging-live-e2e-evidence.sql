-- AurumVault Canva Creator Studio — staging live-E2E evidence collector
-- READ ONLY. Run only against the isolated staging backend.
-- Purpose: capture objective post-run evidence before any PR/merge decision.

-- 1) Imported products and mappings. After one successful import, expect one
-- Canva mapping for the test user/design and one corresponding draft product.
SELECT
  cdp.user_id,
  cdp.canva_design_id,
  cdp.product_id,
  cdp.source_title,
  cdp.sync_state,
  cdp.imported_at,
  mp.status,
  mp.published,
  mp.product_type,
  mp.cover_url,
  mp.price_cents
FROM public.canva_design_products cdp
JOIN public.marketplace_products mp ON mp.id = cdp.product_id
ORDER BY cdp.imported_at DESC;

-- 2) Orphan mapping check. Expect 0.
SELECT count(*) AS orphan_mappings
FROM public.canva_design_products cdp
LEFT JOIN public.marketplace_products mp ON mp.id = cdp.product_id
WHERE mp.id IS NULL;

-- 3) Duplicate mapping check. Expect 0 rows after importing the same design twice.
SELECT user_id, canva_design_id, count(*) AS mapping_count
FROM public.canva_design_products
GROUP BY user_id, canva_design_id
HAVING count(*) > 1;

-- 4) Product-to-source uniqueness check. Expect 0 rows.
SELECT product_id, count(*) AS mapping_count
FROM public.canva_design_products
GROUP BY product_id
HAVING count(*) > 1;

-- 5) Canva-created drafts must never be auto-published. Expect 0.
SELECT count(*) AS incorrectly_published_canva_products
FROM public.canva_design_products cdp
JOIN public.marketplace_products mp ON mp.id = cdp.product_id
WHERE mp.status <> 'draft'::product_status OR mp.published IS DISTINCT FROM false;

-- 6) Confirm the staging product contract needed by the importer.
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'marketplace_products'
  AND column_name IN (
    'seller_id', 'title', 'description', 'category', 'price_cents', 'cover_url',
    'status', 'product_type', 'published', 'slug', 'release_date'
  )
ORDER BY ordinal_position;

-- 7) Confirm RLS is enabled on every Canva-sensitive table. Expect true for all.
SELECT n.nspname AS schema_name, c.relname AS table_name, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('integration_connections', 'canva_design_products', 'marketplace_products')
ORDER BY c.relname;

-- 8) Confirm authenticated clients cannot SELECT encrypted OAuth material.
-- Expect only approved non-secret columns; access_token_enc, refresh_token_enc,
-- code_verifier_enc, oauth_state, metadata and refresh_version must not appear.
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'integration_connections'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type, column_name;

-- 9) Confirm no table-level write privilege leaked to anon/authenticated.
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('integration_connections', 'canva_design_products')
  AND grantee IN ('authenticated', 'anon')
ORDER BY table_name, grantee, privilege_type;

-- 10) Inspect recent Canva cover artifacts. The same-design retry should not create
-- a second retained product mapping. A failed/racing import should clean up its
-- temporary cover best-effort; investigate unexpected extras before release.
SELECT bucket_id, name, created_at, updated_at, metadata
FROM storage.objects
WHERE bucket_id = 'product-covers'
  AND name LIKE '%/canva-%'
ORDER BY created_at DESC
LIMIT 50;
