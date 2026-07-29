-- 1. Forum: block author self-approval via a trigger
CREATE OR REPLACE FUNCTION public.creator_forum_posts_guard_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Non-admins (including the post's author) may not change status at all.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only admins can change forum post status';
  END IF;

  -- Extra defense: non-admins cannot reassign authorship or moderation counters.
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'Author cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_forum_posts_guard_status_trg ON public.creator_forum_posts;
CREATE TRIGGER creator_forum_posts_guard_status_trg
  BEFORE UPDATE ON public.creator_forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.creator_forum_posts_guard_status();

-- 2. Seller applications: ensure applicants cannot alter their own record after submission.
-- Admin-only ALL policy already exists; explicitly guard against a stray future self-update
-- policy by adding a trigger that blocks non-admin writes to status/admin-controlled fields.
CREATE OR REPLACE FUNCTION public.seller_applications_guard_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.admin_feedback IS DISTINCT FROM OLD.admin_feedback
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reapply_after IS DISTINCT FROM OLD.reapply_after
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Only admins can modify application review fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seller_applications_guard_admin_fields_trg ON public.seller_applications;
CREATE TRIGGER seller_applications_guard_admin_fields_trg
  BEFORE UPDATE ON public.seller_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.seller_applications_guard_admin_fields();