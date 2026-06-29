-- Fix critical security findings before publishing

-- 1) Prevent privilege escalation: only admins can insert user_roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;

CREATE POLICY "Only admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins have full access to user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2) Allow buyers to read their own order download tokens
DROP POLICY IF EXISTS "Buyers can read their download tokens" ON public.order_downloads;
DROP POLICY IF EXISTS "Admins can read all download tokens" ON public.order_downloads;

CREATE POLICY "Buyers can read their download tokens"
ON public.order_downloads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = order_downloads.order_item_id
      AND o.buyer_email = auth.email()
  )
);

CREATE POLICY "Admins can read all download tokens"
ON public.order_downloads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Defensively recreate has_role helper with safe search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
