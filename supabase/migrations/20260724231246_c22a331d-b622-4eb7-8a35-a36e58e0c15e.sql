-- Restore anon read access to the two AI review columns used by public product cards.
-- These are non-sensitive moderation flags (status + numeric score) shown as a badge.
GRANT SELECT (ai_review_status, ai_review_score) ON public.marketplace_products TO anon;
