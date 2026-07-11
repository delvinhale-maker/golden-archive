import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const redirectTo = `${location.pathname}${location.searchStr}${location.hash}`;
      throw redirect({ to: "/auth", search: { redirect: redirectTo } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
