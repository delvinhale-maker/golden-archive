
REVOKE SELECT (user_id) ON public.product_reviews FROM anon;
REVOKE SELECT (user_id) ON public.product_reviews FROM authenticated;

REVOKE SELECT (applicant_email, admin_notes, admin_feedback, reapply_after) ON public.seller_applications FROM anon;
REVOKE SELECT (applicant_email, admin_notes, admin_feedback, reapply_after) ON public.seller_applications FROM authenticated;

-- Restore admin/owner access via a security-definer path is not needed:
-- admin surfaces run through service_role in server functions where required,
-- or through has_role checks in RLS on tables that keep column privileges.
-- Grant these columns back to service_role explicitly to be safe.
GRANT SELECT (applicant_email, admin_notes, admin_feedback, reapply_after) ON public.seller_applications TO service_role;
GRANT SELECT (user_id) ON public.product_reviews TO service_role;
