
-- Academy Editorial Studio: add fields, versions, related links, storage policies

-- 1. Enum for difficulty
DO $$ BEGIN
  CREATE TYPE public.academy_difficulty AS ENUM ('beginner','intermediate','advanced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend academy_articles
ALTER TABLE public.academy_articles
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS difficulty public.academy_difficulty NOT NULL DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS editors_pick boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_latest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_alt text,
  ADD COLUMN IF NOT EXISTS cover_caption text,
  ADD COLUMN IF NOT EXISTS focus_keyword text,
  ADD COLUMN IF NOT EXISTS secondary_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS og_title text,
  ADD COLUMN IF NOT EXISTS og_description text,
  ADD COLUMN IF NOT EXISTS twitter_card text NOT NULL DEFAULT 'summary_large_image',
  ADD COLUMN IF NOT EXISTS schema_type text NOT NULL DEFAULT 'Article',
  ADD COLUMN IF NOT EXISTS robots_index boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS robots_follow boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS word_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_autosaved_at timestamptz;

-- 3. Version snapshots
CREATE TABLE IF NOT EXISTS public.academy_article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.academy_articles(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  saved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.academy_article_versions TO authenticated;
GRANT ALL ON public.academy_article_versions TO service_role;
ALTER TABLE public.academy_article_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage article versions" ON public.academy_article_versions;
CREATE POLICY "Admins manage article versions" ON public.academy_article_versions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX IF NOT EXISTS academy_article_versions_article_idx
  ON public.academy_article_versions(article_id, saved_at DESC);

-- 4. Related-article links
CREATE TABLE IF NOT EXISTS public.academy_article_related (
  article_id uuid NOT NULL REFERENCES public.academy_articles(id) ON DELETE CASCADE,
  related_id uuid NOT NULL REFERENCES public.academy_articles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, related_id),
  CHECK (article_id <> related_id)
);
GRANT SELECT ON public.academy_article_related TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_article_related TO authenticated;
GRANT ALL ON public.academy_article_related TO service_role;
ALTER TABLE public.academy_article_related ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Related links are public read" ON public.academy_article_related;
CREATE POLICY "Related links are public read" ON public.academy_article_related
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage related links" ON public.academy_article_related;
CREATE POLICY "Admins manage related links" ON public.academy_article_related
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Storage policies for academy-covers bucket (public read, admin write)
DROP POLICY IF EXISTS "Academy covers are publicly readable" ON storage.objects;
CREATE POLICY "Academy covers are publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'academy-covers');

DROP POLICY IF EXISTS "Admins upload academy covers" ON storage.objects;
CREATE POLICY "Admins upload academy covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'academy-covers' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update academy covers" ON storage.objects;
CREATE POLICY "Admins update academy covers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'academy-covers' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'academy-covers' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins delete academy covers" ON storage.objects;
CREATE POLICY "Admins delete academy covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'academy-covers' AND public.has_role(auth.uid(), 'admin'::public.app_role));
