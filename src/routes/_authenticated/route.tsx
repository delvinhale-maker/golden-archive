import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const redirectTo = `${location.pathname}${location.searchStr}${location.hash}`;
      const search: { redirect: string; message?: string } = { redirect: redirectTo };
      if (location.pathname.startsWith("/dashboard/new")) {
        const type = new URLSearchParams(location.searchStr).get("type");
        const isEbook = type === "ebook";
        search.message = isEbook
          ? "Sign in to continue uploading your eBook — we'll bring you right back to the upload page."
          : "Sign in to continue your upload — we'll bring you right back to where you left off.";
      }
      throw redirect({ to: "/auth", search });
    }
    return { user: data.user };
  },

  component: () => <Outlet />,
});
