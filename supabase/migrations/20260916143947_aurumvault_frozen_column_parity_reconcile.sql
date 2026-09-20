ALTER TABLE public.affiliate_products
  ADD COLUMN IF NOT EXISTS deal_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deal_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS affiliate_products_active_featured_idx ON public.affiliate_products(active,featured DESC,created_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_products_deal_idx ON public.affiliate_products(deal_active,deal_expires_at DESC) WHERE deal_active=true;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_preorder_at_purchase boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bump boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bundle_id uuid,
  ADD COLUMN IF NOT EXISTS bundle_name text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.order_items'::regclass AND conname='order_items_bundle_id_fkey') THEN
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.marketplace_bundles(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON public.order_items(seller_id);
CREATE INDEX IF NOT EXISTS order_items_bundle_idx ON public.order_items(bundle_id);
CREATE INDEX IF NOT EXISTS order_items_variant_idx ON public.order_items(variant_id);

ALTER TABLE public.seller_applications
  ADD COLUMN IF NOT EXISTS campaign text,
  ADD COLUMN IF NOT EXISTS campaign_source text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS referring_url text,
  ADD COLUMN IF NOT EXISTS creator_lead_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.seller_applications'::regclass AND conname='seller_applications_creator_lead_id_fkey') THEN
    ALTER TABLE public.seller_applications ADD CONSTRAINT seller_applications_creator_lead_id_fkey FOREIGN KEY (creator_lead_id) REFERENCES public.creator_leads(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS seller_applications_brand_slug_key ON public.seller_applications(brand_slug) WHERE brand_slug IS NOT NULL;

ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS sequence_step2_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sequence_step3_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS topic_interest text,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS consent_version text DEFAULT 'insider-v1',
  ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.subscribers'::regclass AND conname='subscribers_audience_type_check') THEN
    ALTER TABLE public.subscribers ADD CONSTRAINT subscribers_audience_type_check CHECK (audience_type IN ('GENERAL','CREATOR','BUSINESS_TOOL'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS subscribers_audience_type_idx ON public.subscribers(audience_type);
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_confirmation_token_idx ON public.subscribers(confirmation_token) WHERE confirmation_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_lower_idx ON public.subscribers(lower(email));
CREATE INDEX IF NOT EXISTS subscribers_sequence_due_idx ON public.subscribers(status,confirmed_at);
CREATE INDEX IF NOT EXISTS subscribers_status_created_idx ON public.subscribers(status,created_at DESC);