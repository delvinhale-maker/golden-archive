REVOKE SELECT (ai_review_status, ai_review_score) ON public.marketplace_products FROM anon;
REVOKE SELECT (file_path, file_size_bytes) ON public.product_variants FROM anon;