-- AurumVault SEO Phase 2 — additive product SEO metadata.
--
-- NOT YET APPLIED. Purely additive: adds optional per-product SEO override
-- columns to public.marketplace_products. It does NOT update, insert or
-- delete any product row, does NOT touch slugs, and does NOT alter redirect
-- behavior or the 14 deferred optional slug changes.

ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_focus_keyword text,
  ADD COLUMN IF NOT EXISTS seo_secondary_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS seo_image_alt text,
  ADD COLUMN IF NOT EXISTS seo_og_title text,
  ADD COLUMN IF NOT EXISTS seo_og_description text,
  ADD COLUMN IF NOT EXISTS seo_robots_index boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS seo_robots_follow boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS seo_updated_at timestamptz;

-- Length guards mirroring the admin-side validation.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_products_seo_title_len') THEN
    ALTER TABLE public.marketplace_products
      ADD CONSTRAINT marketplace_products_seo_title_len
      CHECK (seo_title IS NULL OR char_length(seo_title) <= 200);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_products_seo_description_len') THEN
    ALTER TABLE public.marketplace_products
      ADD CONSTRAINT marketplace_products_seo_description_len
      CHECK (seo_description IS NULL OR char_length(seo_description) <= 500);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_products_seo_image_alt_len') THEN
    ALTER TABLE public.marketplace_products
      ADD CONSTRAINT marketplace_products_seo_image_alt_len
      CHECK (seo_image_alt IS NULL OR char_length(seo_image_alt) <= 300);
  END IF;
END $$;

COMMENT ON COLUMN public.marketplace_products.seo_title IS
  'Optional override for the product page <title>. Falls back to the generated title when null.';
COMMENT ON COLUMN public.marketplace_products.seo_description IS
  'Optional override for the product page meta description. Structured data keeps using the visible product description.';
COMMENT ON COLUMN public.marketplace_products.seo_focus_keyword IS
  'INTERNAL PLANNING FIELD ONLY. MUST NOT be emitted as a meta keywords tag or any other rendered markup.';
COMMENT ON COLUMN public.marketplace_products.seo_secondary_keywords IS
  'INTERNAL PLANNING FIELD ONLY. MUST NOT be emitted as meta keywords or any other rendered markup.';
COMMENT ON COLUMN public.marketplace_products.seo_image_alt IS
  'Optional override for the visible primary product image alt text.';
COMMENT ON COLUMN public.marketplace_products.seo_og_title IS
  'Optional override for og:title / twitter:title.';
COMMENT ON COLUMN public.marketplace_products.seo_og_description IS
  'Optional override for og:description / twitter:description.';
COMMENT ON COLUMN public.marketplace_products.seo_robots_index IS
  'When false, the published product page emits noindex and is omitted from the sitemap.';
COMMENT ON COLUMN public.marketplace_products.seo_robots_follow IS
  'When false, the published product page emits nofollow.';
COMMENT ON COLUMN public.marketplace_products.seo_updated_at IS
  'Timestamp of the last SEO-metadata-only edit. Set by the admin product SEO editor.';