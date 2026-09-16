DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typname='academy_difficulty'
  ) THEN
    CREATE TYPE public.academy_difficulty AS ENUM ('beginner','intermediate','advanced');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.academy_categories (
  slug text PRIMARY KEY,
  name text NOT NULL,
  emoji text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academy_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  body text NOT NULL DEFAULT '',
  featured_image text,
  category text NOT NULL REFERENCES public.academy_categories(slug),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  reading_time_min integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published')),
  published_at timestamptz,
  scheduled_for timestamptz,
  featured boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  view_count bigint NOT NULL DEFAULT 0,
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  subtitle text,
  difficulty public.academy_difficulty NOT NULL DEFAULT 'beginner',
  tags text[] NOT NULL DEFAULT '{}',
  editors_pick boolean NOT NULL DEFAULT false,
  is_latest boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  cover_alt text,
  cover_caption text,
  focus_keyword text,
  secondary_keywords text[] NOT NULL DEFAULT '{}',
  canonical_url text,
  og_title text,
  og_description text,
  twitter_card text NOT NULL DEFAULT 'summary_large_image',
  schema_type text NOT NULL DEFAULT 'Article',
  robots_index boolean NOT NULL DEFAULT true,
  robots_follow boolean NOT NULL DEFAULT true,
  word_count integer NOT NULL DEFAULT 0,
  last_autosaved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.academy_article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.academy_articles(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  saved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academy_article_related (
  article_id uuid NOT NULL REFERENCES public.academy_articles(id) ON DELETE CASCADE,
  related_id uuid NOT NULL REFERENCES public.academy_articles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, related_id),
  CHECK (article_id <> related_id)
);

CREATE TABLE IF NOT EXISTS public.academy_article_products (
  article_id uuid NOT NULL REFERENCES public.academy_articles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.academy_bookmarks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.academy_articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);

CREATE INDEX IF NOT EXISTS academy_article_versions_article_idx ON public.academy_article_versions(article_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS academy_articles_category_idx ON public.academy_articles(category, published_at DESC);
CREATE INDEX IF NOT EXISTS academy_articles_published_idx ON public.academy_articles(status, published_at DESC);

DROP TRIGGER IF EXISTS academy_articles_touch ON public.academy_articles;
CREATE TRIGGER academy_articles_touch BEFORE UPDATE ON public.academy_articles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.academy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_article_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_article_related ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_article_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_bookmarks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.academy_categories, public.academy_articles, public.academy_article_versions, public.academy_article_related, public.academy_article_products, public.academy_bookmarks FROM anon, authenticated;
GRANT ALL ON public.academy_categories, public.academy_articles, public.academy_article_versions, public.academy_article_related, public.academy_article_products, public.academy_bookmarks TO service_role;
GRANT SELECT ON public.academy_categories, public.academy_articles, public.academy_article_related, public.academy_article_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_categories, public.academy_articles, public.academy_article_versions, public.academy_article_related, public.academy_article_products, public.academy_bookmarks TO authenticated;

DROP POLICY IF EXISTS "Categories are public" ON public.academy_categories;
CREATE POLICY "Categories are public" ON public.academy_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage categories" ON public.academy_categories;
CREATE POLICY "Admins manage categories" ON public.academy_categories FOR ALL TO authenticated USING (public.has_role((select auth.uid()), 'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Published articles are public" ON public.academy_articles;
CREATE POLICY "Published articles are public" ON public.academy_articles FOR SELECT TO anon, authenticated USING (status='published' AND published_at <= now());
DROP POLICY IF EXISTS "Admins read all articles" ON public.academy_articles;
CREATE POLICY "Admins read all articles" ON public.academy_articles FOR SELECT TO authenticated USING (public.has_role((select auth.uid()), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins write articles" ON public.academy_articles;
CREATE POLICY "Admins write articles" ON public.academy_articles FOR ALL TO authenticated USING (public.has_role((select auth.uid()), 'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage article versions" ON public.academy_article_versions;
CREATE POLICY "Admins manage article versions" ON public.academy_article_versions FOR ALL TO authenticated USING (public.has_role((select auth.uid()), 'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Related links are public read" ON public.academy_article_related;
CREATE POLICY "Related links are public read" ON public.academy_article_related FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage related links" ON public.academy_article_related;
CREATE POLICY "Admins manage related links" ON public.academy_article_related FOR ALL TO authenticated USING (public.has_role((select auth.uid()), 'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Article product tags are public" ON public.academy_article_products;
CREATE POLICY "Article product tags are public" ON public.academy_article_products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage article product tags" ON public.academy_article_products;
CREATE POLICY "Admins manage article product tags" ON public.academy_article_products FOR ALL TO authenticated USING (public.has_role((select auth.uid()), 'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users manage own bookmarks" ON public.academy_bookmarks;
CREATE POLICY "Users manage own bookmarks" ON public.academy_bookmarks FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);