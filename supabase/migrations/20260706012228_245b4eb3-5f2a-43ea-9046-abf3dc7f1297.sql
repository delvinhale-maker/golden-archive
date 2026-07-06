
-- =========================================================================
-- Enums
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.creator_forum_category AS ENUM ('question','win','feedback');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.creator_forum_status AS ENUM ('pending','approved','hidden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- creator_announcements
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.creator_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.creator_announcements TO anon;
GRANT SELECT ON public.creator_announcements TO authenticated;
GRANT ALL ON public.creator_announcements TO service_role;
ALTER TABLE public.creator_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads published announcements" ON public.creator_announcements;
CREATE POLICY "Anyone reads published announcements"
  ON public.creator_announcements FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage announcements" ON public.creator_announcements;
CREATE POLICY "Admins manage announcements"
  ON public.creator_announcements FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_creator_announcements_touch ON public.creator_announcements;
CREATE TRIGGER trg_creator_announcements_touch
  BEFORE UPDATE ON public.creator_announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_creator_announcements_pub
  ON public.creator_announcements(published, pinned DESC, created_at DESC);

-- =========================================================================
-- creator_announcement_reads
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.creator_announcement_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id uuid NOT NULL REFERENCES public.creator_announcements(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);
GRANT SELECT, INSERT, DELETE ON public.creator_announcement_reads TO authenticated;
GRANT ALL ON public.creator_announcement_reads TO service_role;
ALTER TABLE public.creator_announcement_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own read receipts" ON public.creator_announcement_reads;
CREATE POLICY "Users read own read receipts"
  ON public.creator_announcement_reads FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own read receipts" ON public.creator_announcement_reads;
CREATE POLICY "Users insert own read receipts"
  ON public.creator_announcement_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own read receipts" ON public.creator_announcement_reads;
CREATE POLICY "Users delete own read receipts"
  ON public.creator_announcement_reads FOR DELETE
  USING (auth.uid() = user_id);

-- =========================================================================
-- creator_forum_posts
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.creator_forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  category public.creator_forum_category NOT NULL DEFAULT 'question',
  status public.creator_forum_status NOT NULL DEFAULT 'pending',
  likes_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_forum_posts TO authenticated;
GRANT ALL ON public.creator_forum_posts TO service_role;
ALTER TABLE public.creator_forum_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read approved posts or own" ON public.creator_forum_posts;
CREATE POLICY "Read approved posts or own"
  ON public.creator_forum_posts FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    OR author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated create own posts" ON public.creator_forum_posts;
CREATE POLICY "Authenticated create own posts"
  ON public.creator_forum_posts FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Author edits own or admin any" ON public.creator_forum_posts;
CREATE POLICY "Author edits own or admin any"
  ON public.creator_forum_posts FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Author deletes own or admin any" ON public.creator_forum_posts;
CREATE POLICY "Author deletes own or admin any"
  ON public.creator_forum_posts FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_creator_forum_posts_touch ON public.creator_forum_posts;
CREATE TRIGGER trg_creator_forum_posts_touch
  BEFORE UPDATE ON public.creator_forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_forum_posts_status_created
  ON public.creator_forum_posts(status, created_at DESC);

-- =========================================================================
-- creator_forum_replies
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.creator_forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.creator_forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_forum_replies TO authenticated;
GRANT ALL ON public.creator_forum_replies TO service_role;
ALTER TABLE public.creator_forum_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read replies on approved posts" ON public.creator_forum_replies;
CREATE POLICY "Read replies on approved posts"
  ON public.creator_forum_replies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_forum_posts p
      WHERE p.id = post_id
        AND (p.status = 'approved'
             OR p.author_id = auth.uid()
             OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

DROP POLICY IF EXISTS "Authenticated reply own" ON public.creator_forum_replies;
CREATE POLICY "Authenticated reply own"
  ON public.creator_forum_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.creator_forum_posts p
      WHERE p.id = post_id AND p.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Author manages own reply or admin" ON public.creator_forum_replies;
CREATE POLICY "Author manages own reply or admin"
  ON public.creator_forum_replies FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_forum_replies_post
  ON public.creator_forum_replies(post_id, created_at ASC);

-- Reply count trigger
CREATE OR REPLACE FUNCTION public.bump_forum_reply_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.creator_forum_posts SET reply_count = reply_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.creator_forum_posts SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $fn$;

DROP TRIGGER IF EXISTS trg_bump_forum_reply_count ON public.creator_forum_replies;
CREATE TRIGGER trg_bump_forum_reply_count
  AFTER INSERT OR DELETE ON public.creator_forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.bump_forum_reply_count();

-- =========================================================================
-- creator_forum_likes
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.creator_forum_likes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.creator_forum_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT, INSERT, DELETE ON public.creator_forum_likes TO authenticated;
GRANT ALL ON public.creator_forum_likes TO service_role;
ALTER TABLE public.creator_forum_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own likes" ON public.creator_forum_likes;
CREATE POLICY "Read own likes"
  ON public.creator_forum_likes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Insert own like" ON public.creator_forum_likes;
CREATE POLICY "Insert own like"
  ON public.creator_forum_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own like" ON public.creator_forum_likes;
CREATE POLICY "Delete own like"
  ON public.creator_forum_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bump_forum_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.creator_forum_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.creator_forum_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $fn$;

DROP TRIGGER IF EXISTS trg_bump_forum_like_count ON public.creator_forum_likes;
CREATE TRIGGER trg_bump_forum_like_count
  AFTER INSERT OR DELETE ON public.creator_forum_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_forum_like_count();

-- =========================================================================
-- creator_spotlights
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.creator_spotlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL,
  headline text NOT NULL,
  interview_body text NOT NULL DEFAULT '',
  hero_image_url text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month)
);
GRANT SELECT ON public.creator_spotlights TO anon;
GRANT SELECT ON public.creator_spotlights TO authenticated;
GRANT ALL ON public.creator_spotlights TO service_role;
ALTER TABLE public.creator_spotlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads published spotlights" ON public.creator_spotlights;
CREATE POLICY "Anyone reads published spotlights"
  ON public.creator_spotlights FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage spotlights" ON public.creator_spotlights;
CREATE POLICY "Admins manage spotlights"
  ON public.creator_spotlights FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_creator_spotlights_touch ON public.creator_spotlights;
CREATE TRIGGER trg_creator_spotlights_touch
  BEFORE UPDATE ON public.creator_spotlights
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_creator_spotlights_month
  ON public.creator_spotlights(published, month DESC);
