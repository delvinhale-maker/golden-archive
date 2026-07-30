-- Remove anonymous access to internal marketplace_products columns.
REVOKE SELECT (
  admin_notes,
  rejected_reason,
  ai_review_blurb,
  ai_review_issues,
  ai_review_tags,
  ai_review_status,
  ai_review_score,
  file_path,
  interactive_edition_file_url
) ON public.marketplace_products FROM anon;

-- Remove anonymous access to variant file paths.
REVOKE SELECT (file_path) ON public.product_variants FROM anon;