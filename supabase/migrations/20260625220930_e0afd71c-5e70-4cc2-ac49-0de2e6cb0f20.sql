
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','seller','buyer');
CREATE TYPE public.product_status AS ENUM ('draft','pending','approved','rejected');
CREATE TYPE public.application_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.product_category AS ENUM ('ebooks','courses','templates','audio','leadership');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_seller BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ SELLER APPLICATIONS ============
CREATE TABLE public.seller_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  pitch TEXT NOT NULL,
  product_types TEXT,
  website TEXT,
  status public.application_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.seller_applications TO authenticated;
GRANT ALL ON public.seller_applications TO service_role;
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apps_self_read" ON public.seller_applications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "apps_self_insert" ON public.seller_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "apps_admin_all" ON public.seller_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ MARKETPLACE PRODUCTS ============
CREATE TABLE public.marketplace_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.product_category NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  compare_at_price_cents INTEGER,
  cover_url TEXT,
  file_path TEXT,
  file_size_bytes BIGINT,
  status public.product_status NOT NULL DEFAULT 'draft',
  platform_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 9.00,
  admin_notes TEXT,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);
CREATE INDEX idx_marketplace_products_status ON public.marketplace_products(status);
CREATE INDEX idx_marketplace_products_seller ON public.marketplace_products(seller_id);
CREATE INDEX idx_marketplace_products_category ON public.marketplace_products(category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_products TO authenticated;
GRANT SELECT ON public.marketplace_products TO anon;
GRANT ALL ON public.marketplace_products TO service_role;
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_public_approved_read" ON public.marketplace_products FOR SELECT USING (status = 'approved');
CREATE POLICY "products_seller_read_own" ON public.marketplace_products FOR SELECT TO authenticated USING (seller_id = auth.uid());
CREATE POLICY "products_seller_insert" ON public.marketplace_products FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
CREATE POLICY "products_seller_update_own" ON public.marketplace_products FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() AND status IN ('draft','rejected'))
  WITH CHECK (seller_id = auth.uid());
CREATE POLICY "products_seller_delete_own" ON public.marketplace_products FOR DELETE TO authenticated
  USING (seller_id = auth.uid() AND status IN ('draft','rejected'));
CREATE POLICY "products_admin_all" ON public.marketplace_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.marketplace_products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
