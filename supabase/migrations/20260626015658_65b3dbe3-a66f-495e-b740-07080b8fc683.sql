
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS ai_review_status TEXT,
  ADD COLUMN IF NOT EXISTS ai_review_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_review_issues JSONB,
  ADD COLUMN IF NOT EXISTS ai_review_blurb TEXT,
  ADD COLUMN IF NOT EXISTS ai_review_seo_title TEXT,
  ADD COLUMN IF NOT EXISTS ai_review_tags JSONB,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMPTZ;
