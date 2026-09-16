DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='creator_forum_category') THEN
    CREATE TYPE public.creator_forum_category AS ENUM ('question','win','feedback');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='creator_forum_status') THEN
    CREATE TYPE public.creator_forum_status AS ENUM ('pending','approved','hidden');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.creator_activation (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_at timestamptz,
  profile_completed_at timestamptz,
  first_product_started_at timestamptz,
  first_product_submitted_at timestamptz,
  first_product_approved_at timestamptz,
  first_product_published_at timestamptz,
  first_sale_at timestamptz,
  nudge_profile_sent_at timestamptz,
  nudge_first_product_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.creator_announcement_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id uuid NOT NULL REFERENCES public.creator_announcements(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

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

CREATE TABLE IF NOT EXISTS public.creator_forum_likes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.creator_forum_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS public.creator_forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.creator_forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_lead_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  product_type text NOT NULL DEFAULT 'unspecified',
  follower_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  cta_source text,
  first_name text,
  normalized_email text,
  acquisition_type text NOT NULL DEFAULT 'CREATOR_LEAD',
  marketing_consent boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  consent_source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referring_url text,
  landing_page text,
  starter_pack_requested_at timestamptz,
  starter_pack_last_sent_at timestamptz,
  starter_pack_send_count integer NOT NULL DEFAULT 0,
  last_send_status text,
  nurture_step2_sent_at timestamptz,
  nurture_step3_sent_at timestamptz,
  nurture_step4_sent_at timestamptz,
  nurture_step5_sent_at timestamptz,
  seller_application_id uuid REFERENCES public.seller_applications(id) ON DELETE SET NULL,
  application_submitted_at timestamptz,
  converted_to_creator_at timestamptz,
  lead_status text NOT NULL DEFAULT 'NEW',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_payout_methods (
  seller_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  method text NOT NULL CONSTRAINT creator_payout_methods_method_check CHECK (method IN ('bank','paypal','wise','other')),
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  frequency text NOT NULL DEFAULT 'weekly' CONSTRAINT creator_payout_methods_frequency_check CHECK (frequency IN ('weekly','monthly'))
);

CREATE TABLE IF NOT EXISTS public.creator_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text,
  profile_url text,
  contact_email text,
  niche text,
  audience_size integer,
  status text NOT NULL DEFAULT 'identified' CONSTRAINT creator_prospects_status_check CHECK (status IN ('identified','contacted','replied','applied','approved','declined','not_a_fit')),
  notes text,
  last_contacted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 year'),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.creator_spotlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL UNIQUE,
  headline text NOT NULL,
  interview_body text NOT NULL DEFAULT '',
  hero_image_url text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_storefront_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL,
  kind text NOT NULL CONSTRAINT creator_storefront_event_kind CHECK (kind IN ('storefront_view','product_click','share','qr')),
  product_id uuid,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_storefront_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  headline text CONSTRAINT creator_storefront_headline_len CHECK (headline IS NULL OR char_length(headline) <= 90),
  logo_url text,
  accent text NOT NULL DEFAULT 'gold' CONSTRAINT creator_storefront_accent_allowed CHECK (accent IN ('gold','emerald','sapphire','burgundy','slate')),
  featured_product_ids uuid[] NOT NULL DEFAULT '{}' CONSTRAINT creator_storefront_featured_max CHECK (array_length(featured_product_ids,1) IS NULL OR array_length(featured_product_ids,1) <= 6),
  featured_bundle_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_tax_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_type text NOT NULL CONSTRAINT creator_tax_forms_form_type_check CHECK (form_type IN ('W9','W8BEN')),
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CONSTRAINT creator_tax_forms_status_check CHECK (status IN ('submitted','approved','rejected')),
  admin_note text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cta_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  cta_location text NOT NULL,
  page_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CONSTRAINT error_logs_source_check CHECK (source IN ('client','server','boundary','unhandled_rejection','window_error')),
  severity text NOT NULL DEFAULT 'error' CONSTRAINT error_logs_severity_check CHECK (severity IN ('warn','error','fatal')),
  message text NOT NULL,
  stack text,
  url text,
  user_agent text,
  user_id uuid,
  route text,
  fingerprint text,
  context jsonb NOT NULL DEFAULT '{}',
  alerted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.founding_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  founding_number integer NOT NULL UNIQUE CONSTRAINT founding_creators_founding_number_check CHECK (founding_number BETWEEN 1 AND 100),
  seller_application_id uuid REFERENCES public.seller_applications(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.creator_leads(id) ON DELETE SET NULL,
  campaign_source text,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.homepage_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  kind text NOT NULL CONSTRAINT homepage_layout_kind_check CHECK (kind IN ('section','affiliate')),
  position integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insider_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subject text NOT NULL,
  preview_text text,
  body_md text NOT NULL DEFAULT '',
  audience_type text NOT NULL DEFAULT 'GENERAL' CONSTRAINT insider_editions_audience_check CHECK (audience_type IN ('GENERAL','CREATOR','BUSINESS_TOOL')),
  status text NOT NULL DEFAULT 'draft' CONSTRAINT insider_editions_status_check CHECK (status IN ('draft','published','sent')),
  is_public boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  sent_at timestamptz,
  recipients_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_announcements_pub ON public.creator_announcements(published,pinned DESC,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_status_created ON public.creator_forum_posts(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON public.creator_forum_replies(post_id,created_at);
CREATE INDEX IF NOT EXISTS creator_lead_rate_limits_ip_time_idx ON public.creator_lead_rate_limits(ip_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS creator_leads_acquisition_idx ON public.creator_leads(acquisition_type,created_at DESC);
CREATE INDEX IF NOT EXISTS creator_leads_created_at_idx ON public.creator_leads(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS creator_leads_email_product_type_key ON public.creator_leads(email,product_type);
CREATE UNIQUE INDEX IF NOT EXISTS creator_leads_normalized_email_key ON public.creator_leads(normalized_email);
CREATE INDEX IF NOT EXISTS creator_leads_nurture_idx ON public.creator_leads(marketing_consent,starter_pack_requested_at);
CREATE INDEX IF NOT EXISTS creator_referrals_referrer_idx ON public.creator_referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_creator_spotlights_month ON public.creator_spotlights(published,month DESC);
CREATE INDEX IF NOT EXISTS creator_storefront_events_creator_idx ON public.creator_storefront_events(creator_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS creator_tax_forms_seller_idx ON public.creator_tax_forms(seller_id,submitted_at DESC);
CREATE INDEX IF NOT EXISTS cta_click_events_session_idx ON public.cta_click_events(session_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint ON public.error_logs(fingerprint,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_occurred ON public.error_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity,occurred_at DESC);

CREATE OR REPLACE FUNCTION public.bump_forum_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.creator_forum_posts SET likes_count=likes_count+1 WHERE id=NEW.post_id; RETURN NEW;
  ELSIF TG_OP='DELETE' THEN UPDATE public.creator_forum_posts SET likes_count=GREATEST(likes_count-1,0) WHERE id=OLD.post_id; RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.bump_forum_reply_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.creator_forum_posts SET reply_count=reply_count+1 WHERE id=NEW.post_id; RETURN NEW;
  ELSIF TG_OP='DELETE' THEN UPDATE public.creator_forum_posts SET reply_count=GREATEST(reply_count-1,0) WHERE id=OLD.post_id; RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.creator_forum_posts_guard_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF public.has_role(auth.uid(),'admin'::public.app_role) THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Only admins can change forum post status'; END IF;
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN RAISE EXCEPTION 'Author cannot be changed'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.creator_leads_normalize()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  NEW.normalized_email := lower(btrim(NEW.email));
  NEW.updated_at := now();
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.bump_forum_like_count() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_forum_reply_count() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.creator_forum_posts_guard_status() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.creator_leads_normalize() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS creator_activation_touch ON public.creator_activation;
CREATE TRIGGER creator_activation_touch BEFORE UPDATE ON public.creator_activation FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_creator_announcements_touch ON public.creator_announcements;
CREATE TRIGGER trg_creator_announcements_touch BEFORE UPDATE ON public.creator_announcements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_bump_forum_like_count ON public.creator_forum_likes;
CREATE TRIGGER trg_bump_forum_like_count AFTER INSERT OR DELETE ON public.creator_forum_likes FOR EACH ROW EXECUTE FUNCTION public.bump_forum_like_count();
DROP TRIGGER IF EXISTS creator_forum_posts_guard_status_trg ON public.creator_forum_posts;
CREATE TRIGGER creator_forum_posts_guard_status_trg BEFORE UPDATE ON public.creator_forum_posts FOR EACH ROW EXECUTE FUNCTION public.creator_forum_posts_guard_status();
DROP TRIGGER IF EXISTS trg_creator_forum_posts_touch ON public.creator_forum_posts;
CREATE TRIGGER trg_creator_forum_posts_touch BEFORE UPDATE ON public.creator_forum_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_bump_forum_reply_count ON public.creator_forum_replies;
CREATE TRIGGER trg_bump_forum_reply_count AFTER INSERT OR DELETE ON public.creator_forum_replies FOR EACH ROW EXECUTE FUNCTION public.bump_forum_reply_count();
DROP TRIGGER IF EXISTS creator_leads_normalize_trg ON public.creator_leads;
CREATE TRIGGER creator_leads_normalize_trg BEFORE INSERT OR UPDATE ON public.creator_leads FOR EACH ROW EXECUTE FUNCTION public.creator_leads_normalize();
DROP TRIGGER IF EXISTS creator_payout_methods_touch ON public.creator_payout_methods;
CREATE TRIGGER creator_payout_methods_touch BEFORE UPDATE ON public.creator_payout_methods FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS creator_prospects_touch ON public.creator_prospects;
CREATE TRIGGER creator_prospects_touch BEFORE UPDATE ON public.creator_prospects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_creator_spotlights_touch ON public.creator_spotlights;
CREATE TRIGGER trg_creator_spotlights_touch BEFORE UPDATE ON public.creator_spotlights FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS creator_storefront_settings_updated_at ON public.creator_storefront_settings;
CREATE TRIGGER creator_storefront_settings_updated_at BEFORE UPDATE ON public.creator_storefront_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS creator_tax_forms_touch ON public.creator_tax_forms;
CREATE TRIGGER creator_tax_forms_touch BEFORE UPDATE ON public.creator_tax_forms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS homepage_layout_touch ON public.homepage_layout;
CREATE TRIGGER homepage_layout_touch BEFORE UPDATE ON public.homepage_layout FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS update_insider_editions_updated_at ON public.insider_editions;
CREATE TRIGGER update_insider_editions_updated_at BEFORE UPDATE ON public.insider_editions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.creator_activation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_forum_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_lead_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payout_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_spotlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_storefront_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_storefront_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_tax_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cta_click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founding_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insider_editions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.creator_activation,public.creator_announcement_reads,public.creator_announcements,public.creator_forum_likes,public.creator_forum_posts,public.creator_forum_replies,public.creator_lead_rate_limits,public.creator_leads,public.creator_payout_methods,public.creator_prospects,public.creator_referrals,public.creator_spotlights,public.creator_storefront_events,public.creator_storefront_settings,public.creator_tax_forms,public.cta_click_events,public.error_logs,public.founding_creators,public.homepage_layout,public.insider_editions FROM anon,authenticated;
GRANT ALL ON public.creator_activation,public.creator_announcement_reads,public.creator_announcements,public.creator_forum_likes,public.creator_forum_posts,public.creator_forum_replies,public.creator_lead_rate_limits,public.creator_leads,public.creator_payout_methods,public.creator_prospects,public.creator_referrals,public.creator_spotlights,public.creator_storefront_events,public.creator_storefront_settings,public.creator_tax_forms,public.cta_click_events,public.error_logs,public.founding_creators,public.homepage_layout,public.insider_editions TO service_role;
GRANT SELECT ON public.creator_activation,public.creator_lead_rate_limits,public.error_logs,public.creator_referrals TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.creator_announcement_reads,public.creator_forum_likes,public.creator_forum_replies TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.creator_forum_posts,public.creator_payout_methods,public.creator_prospects,public.creator_storefront_settings TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.creator_tax_forms TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.creator_announcements,public.creator_spotlights,public.homepage_layout,public.insider_editions TO authenticated;
GRANT SELECT ON public.creator_announcements,public.creator_spotlights,public.creator_storefront_settings,public.founding_creators,public.homepage_layout,public.insider_editions TO anon;
GRANT SELECT ON public.creator_storefront_events TO authenticated;
GRANT INSERT ON public.creator_storefront_events,public.cta_click_events,public.creator_leads TO anon,authenticated;
GRANT SELECT ON public.creator_leads TO authenticated;

CREATE POLICY "Creators read own activation" ON public.creator_activation FOR SELECT TO authenticated USING ((select auth.uid())=user_id OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Users delete own read receipts" ON public.creator_announcement_reads FOR DELETE TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY "Users insert own read receipts" ON public.creator_announcement_reads FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=user_id);
CREATE POLICY "Users read own read receipts" ON public.creator_announcement_reads FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY "Admins manage announcements" ON public.creator_announcements FOR ALL TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Anyone reads published announcements" ON public.creator_announcements FOR SELECT TO anon,authenticated USING (published=true OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Delete own like" ON public.creator_forum_likes FOR DELETE TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY "Insert own like" ON public.creator_forum_likes FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=user_id);
CREATE POLICY "Read own likes" ON public.creator_forum_likes FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY "Authenticated create own posts" ON public.creator_forum_posts FOR INSERT TO authenticated WITH CHECK (author_id=(select auth.uid()) AND status='pending'::public.creator_forum_status);
CREATE POLICY "Author deletes own or admin any" ON public.creator_forum_posts FOR DELETE TO authenticated USING (author_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Author edits own pending or admin any" ON public.creator_forum_posts FOR UPDATE TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role) OR (author_id=(select auth.uid()) AND status='pending'::public.creator_forum_status)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role) OR (author_id=(select auth.uid()) AND status='pending'::public.creator_forum_status));
CREATE POLICY "Read approved posts or own" ON public.creator_forum_posts FOR SELECT TO authenticated USING (status='approved'::public.creator_forum_status OR author_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Authenticated reply own" ON public.creator_forum_replies FOR INSERT TO authenticated WITH CHECK (author_id=(select auth.uid()) AND EXISTS (SELECT 1 FROM public.creator_forum_posts p WHERE p.id=creator_forum_replies.post_id AND p.status='approved'::public.creator_forum_status));
CREATE POLICY "Author manages own reply or admin" ON public.creator_forum_replies FOR DELETE TO authenticated USING (author_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Read replies on approved posts" ON public.creator_forum_replies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.creator_forum_posts p WHERE p.id=creator_forum_replies.post_id AND (p.status='approved'::public.creator_forum_status OR p.author_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'::public.app_role))));
CREATE POLICY "Admins can view creator lead rate limits" ON public.creator_lead_rate_limits FOR SELECT TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Admins can view creator leads" ON public.creator_leads FOR SELECT TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Anyone can submit a creator lead" ON public.creator_leads FOR INSERT TO anon,authenticated WITH CHECK (char_length(email) BETWEEN 3 AND 255 AND char_length(product_type) BETWEEN 1 AND 60 AND follower_count BETWEEN 0 AND 100000000);
CREATE POLICY "Sellers manage own method" ON public.creator_payout_methods FOR ALL TO authenticated USING ((select auth.uid())=seller_id OR public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK ((select auth.uid())=seller_id);
CREATE POLICY "Admins manage creator prospects" ON public.creator_prospects FOR ALL TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "creator_referrals: read own" ON public.creator_referrals FOR SELECT TO authenticated USING ((select auth.uid())=referrer_user_id OR (select auth.uid())=referred_user_id);
CREATE POLICY "Admins manage spotlights" ON public.creator_spotlights FOR ALL TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Anyone reads published spotlights" ON public.creator_spotlights FOR SELECT TO anon,authenticated USING (published=true OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Anyone can record a storefront event" ON public.creator_storefront_events FOR INSERT TO anon,authenticated WITH CHECK (true);
CREATE POLICY "Creators read only their own storefront events" ON public.creator_storefront_events FOR SELECT TO authenticated USING ((select auth.uid())=creator_user_id OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Creators manage their own storefront settings" ON public.creator_storefront_settings FOR ALL TO authenticated USING ((select auth.uid())=user_id OR public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK ((select auth.uid())=user_id OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Storefront settings are publicly readable" ON public.creator_storefront_settings FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Admins review tax forms" ON public.creator_tax_forms FOR UPDATE TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Sellers submit tax forms" ON public.creator_tax_forms FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=seller_id);
CREATE POLICY "View own or admin tax forms" ON public.creator_tax_forms FOR SELECT TO authenticated USING ((select auth.uid())=seller_id OR public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Anyone can log a CTA click" ON public.cta_click_events FOR INSERT TO anon,authenticated WITH CHECK (true);
CREATE POLICY "Admins read error logs" ON public.error_logs FOR SELECT TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Founding cohort is publicly visible" ON public.founding_creators FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Homepage layout is publicly readable" ON public.homepage_layout FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Only admins can delete homepage layout" ON public.homepage_layout FOR DELETE TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Only admins can insert homepage layout" ON public.homepage_layout FOR INSERT TO authenticated WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Only admins can update homepage layout" ON public.homepage_layout FOR UPDATE TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Admins can delete editions" ON public.insider_editions FOR DELETE TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Admins can insert editions" ON public.insider_editions FOR INSERT TO authenticated WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Admins can read all editions" ON public.insider_editions FOR SELECT TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Admins can update editions" ON public.insider_editions FOR UPDATE TO authenticated USING (public.has_role((select auth.uid()),'admin'::public.app_role)) WITH CHECK (public.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY "Public can read published public editions" ON public.insider_editions FOR SELECT TO anon,authenticated USING (is_public=true AND status IN ('published','sent'));