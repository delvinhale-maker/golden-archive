-- 1) creator_forum_posts: authors may only touch their own PENDING posts, and edits must stay pending.
DROP POLICY IF EXISTS "Author edits own or admin any" ON public.creator_forum_posts;
CREATE POLICY "Author edits own pending or admin any"
ON public.creator_forum_posts
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (author_id = auth.uid() AND status = 'pending'::creator_forum_status)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (author_id = auth.uid() AND status = 'pending'::creator_forum_status)
);

-- 2) product_qa: askers may only edit their own unanswered question and cannot forge admin answers.
DROP POLICY IF EXISTS "Asker can update own" ON public.product_qa;
CREATE POLICY "Asker can update own unanswered question"
ON public.product_qa
FOR UPDATE
TO authenticated
USING (auth.uid() = asker_user_id AND answer IS NULL AND answered_by_admin = false)
WITH CHECK (
  auth.uid() = asker_user_id
  AND answer IS NULL
  AND answered_by_admin = false
  AND answerer_user_id IS NULL
  AND answerer_name IS NULL
  AND answered_at IS NULL
);

-- 3) seller_applications: self-submitted applications must start as pending.
DROP POLICY IF EXISTS "apps_self_insert" ON public.seller_applications;
CREATE POLICY "apps_self_insert"
ON public.seller_applications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending'::application_status);
