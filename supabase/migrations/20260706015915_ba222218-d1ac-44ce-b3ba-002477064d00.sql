-- Lock down creator_followers: hide follower/creator identity from public,
-- expose only an aggregate count via a security-definer RPC.

DROP POLICY IF EXISTS "Anyone can read followers" ON public.creator_followers;

-- Authenticated users can read only rows where they are the follower or the creator.
CREATE POLICY "Users read own follow rows"
  ON public.creator_followers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = creator_user_id);

-- Public aggregate count function (no row-level identity exposure).
CREATE OR REPLACE FUNCTION public.get_creator_follower_count(_creator_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.creator_followers
  WHERE creator_user_id = _creator_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_creator_follower_count(uuid) TO anon, authenticated;

REVOKE SELECT ON public.creator_followers FROM anon;