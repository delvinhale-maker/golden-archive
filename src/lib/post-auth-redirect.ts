/**
 * Pure helper that decides where a user should land after authentication
 * (email/password, signup, or Google OAuth).
 *
 * Priority:
 *   1. An explicit same-origin `savedRedirect` (e.g. from `?redirect=` or the
 *      `av_oauth_redirect` sessionStorage key). This wins for both roles so
 *      deep-links keep working.
 *   2. Sellers → `/dashboard` (their publisher workspace).
 *   3. Buyers  → `/` (the storefront home).
 *
 * A "seller" is any authenticated user that has the `seller` role granted in
 * `public.user_roles`. Admins are treated as sellers for routing purposes
 * because admins always have access to /dashboard.
 */
export type PostAuthRole = "seller" | "admin" | "buyer" | null;

export interface ResolvePostAuthRedirectInput {
  roles: readonly string[] | null | undefined;
  savedRedirect?: string | null;
}

function isSafeSameOriginPath(path: string | null | undefined): path is string {
  if (!path) return false;
  // must be a relative path (starts with a single /) and not a protocol-relative // URL
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  return true;
}

export function resolvePostAuthRedirect({
  roles,
  savedRedirect,
}: ResolvePostAuthRedirectInput): string {
  if (isSafeSameOriginPath(savedRedirect)) return savedRedirect;
  const roleSet = new Set((roles ?? []).map((r) => r.toLowerCase()));
  if (roleSet.has("seller") || roleSet.has("admin")) return "/dashboard";
  return "/";
}
