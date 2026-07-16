
-- Categories
CREATE TABLE public.academy_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academy_categories TO anon, authenticated;
GRANT ALL ON public.academy_categories TO service_role;
ALTER TABLE public.academy_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are public" ON public.academy_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.academy_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.academy_categories(slug, name, emoji, description, sort_order) VALUES
  ('financial-freedom', 'Financial Freedom', '💰', 'Budgeting, saving, investing, passive income, debt management', 1),
  ('ai-productivity', 'AI & Productivity', '🤖', 'ChatGPT, Claude, prompt engineering, automation, business AI', 2),
  ('digital-publishing', 'Digital Publishing', '📚', 'Writing, KDP, selling digital products, online business, marketing', 3),
  ('kingdom-living', 'Kingdom Living', '👑', 'Journaling, stewardship, leadership, purpose, personal growth', 4),
  ('entrepreneurship', 'Entrepreneurship', '📈', 'Starting a business, scaling, systems, branding, digital assets', 5);

-- Articles
CREATE TABLE public.academy_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT NOT NULL DEFAULT '',
  featured_image TEXT,
  category TEXT NOT NULL REFERENCES public.academy_categories(slug),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  reading_time_min INT NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published')),
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  featured BOOLEAN NOT NULL DEFAULT false,
  pinned BOOLEAN NOT NULL DEFAULT false,
  view_count BIGINT NOT NULL DEFAULT 0,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX academy_articles_published_idx ON public.academy_articles(status, published_at DESC);
CREATE INDEX academy_articles_category_idx ON public.academy_articles(category, published_at DESC);
GRANT SELECT ON public.academy_articles TO anon, authenticated;
GRANT ALL ON public.academy_articles TO service_role;
ALTER TABLE public.academy_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published articles are public" ON public.academy_articles FOR SELECT
  USING (status = 'published' AND published_at <= now());
CREATE POLICY "Admins read all articles" ON public.academy_articles FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write articles" ON public.academy_articles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER academy_articles_touch BEFORE UPDATE ON public.academy_articles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Article ↔ Product tags
CREATE TABLE public.academy_article_products (
  article_id UUID NOT NULL REFERENCES public.academy_articles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, product_id)
);
GRANT SELECT ON public.academy_article_products TO anon, authenticated;
GRANT ALL ON public.academy_article_products TO service_role;
ALTER TABLE public.academy_article_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Article product tags are public" ON public.academy_article_products FOR SELECT USING (true);
CREATE POLICY "Admins manage article product tags" ON public.academy_article_products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bookmarks
CREATE TABLE public.academy_bookmarks (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.academy_articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);
GRANT SELECT, INSERT, DELETE ON public.academy_bookmarks TO authenticated;
GRANT ALL ON public.academy_bookmarks TO service_role;
ALTER TABLE public.academy_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bookmarks" ON public.academy_bookmarks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Seed a couple of sample published articles so the hub isn't empty
INSERT INTO public.academy_articles(slug, title, excerpt, body, category, author_name, reading_time_min, status, published_at, featured)
VALUES
  ('how-to-build-a-financial-freedom-plan',
   'How to Build a Financial Freedom Plan',
   'A practical framework for moving from paycheck-to-paycheck to patient, compounding wealth — without gimmicks.',
   E'# How to Build a Financial Freedom Plan\n\nFinancial freedom is not about getting rich quickly. It is about building a system of habits, margins, and investments that compound quietly over decades.\n\n## 1. Establish your baseline\n\nBefore you can grow, you need clarity. Track every dollar for 30 days. Not to shame yourself — to *see* yourself.\n\n## 2. Create margin\n\nCut ruthlessly in three categories: subscriptions you forgot about, food delivery, and lifestyle creep. Redirect that margin into a high-yield savings account.\n\n## 3. Build the vault\n\nA one-month emergency fund is peace. Three months is power. Six is freedom.\n\n## 4. Invest with patience\n\nIndex funds, real estate, and your own skills are the three most reliable engines. Ignore anyone selling you a fourth.\n\n## 5. Steward, don''t hoard\n\nWealth without purpose corrodes. Give generously, invest thoughtfully, and let your money serve people — including your future self.',
   'financial-freedom',
   'AurumVault Editorial',
   7,
   'published',
   now() - interval '2 days',
   true),
  ('prompt-engineering-for-real-work',
   'Prompt Engineering for Real Work (Not Party Tricks)',
   'The prompts that actually save you hours look nothing like the ones that go viral. Here''s the difference.',
   E'# Prompt Engineering for Real Work\n\nMost "prompt engineering" content online is theater. The prompts that compound your leverage are boring, structured, and reusable.\n\n## The four-part frame\n\n1. **Role** — who the model is playing\n2. **Context** — what it needs to know\n3. **Task** — what it should do\n4. **Format** — how the output should be shaped\n\n## Save your best prompts\n\nTreat them like source code. Version them. Reuse them. Iterate on them.\n\n## Measure outcomes, not cleverness\n\nA prompt that saves you 20 minutes a day beats a prompt that impresses strangers on Twitter.',
   'ai-productivity',
   'AurumVault Editorial',
   5,
   'published',
   now() - interval '1 day',
   true),
  ('the-heir-mindset',
   'The Heir Mindset: Building for a Generation You Won''t Meet',
   'Short-term thinking builds businesses that burn out. The heir mindset builds ones that endure.',
   E'# The Heir Mindset\n\nMost founders build for the exit. A few build for the inheritance.\n\n## What changes when you build for heirs\n\n- Your pricing gets fairer, because unfair pricing does not compound over generations\n- Your hiring gets slower, because bad culture compounds too\n- Your marketing gets quieter, because trust is the only moat that survives\n\n## Practical shifts\n\nWrite an annual letter. Keep a decision journal. Talk to customers like you plan to see them again in twenty years — because you might.',
   'kingdom-living',
   'AurumVault Editorial',
   6,
   'published',
   now(),
   true);
