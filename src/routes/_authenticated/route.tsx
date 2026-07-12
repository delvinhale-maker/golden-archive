import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

// This route is `ssr: false`, so the parent SSRs a pending Suspense boundary
// for the whole `_authenticated/*` subtree. The auth check must happen on
// the client (Supabase stores the session in `localStorage`).
//
// We deliberately do NOT `throw redirect()` in a `beforeLoad`: that would
// commit a client-side route change to `/auth` before React's first hydration
// commit, so React hydrates an `<AuthPage>` tree into the SSR-emitted pending
// Suspense marker and throws React #418 ("hydration failed, server rendered
// HTML didn't match the client"). Redirecting from the component via
// `<Navigate>` keeps the very first client render as the same pending shell
// SSR emitted, then transitions to `/auth` on the next commit.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

type AuthState =
  | { status: "checking" }
  | { status: "signedIn"; user: User }
  | { status: "signedOut" };

function AuthenticatedLayout() {
  const [state, setState] = useState<AuthState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        setState({ status: "signedOut" });
      } else {
        setState({ status: "signedIn", user: data.user });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setState({ status: "signedIn", user: session.user });
      else setState({ status: "signedOut" });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state.status === "checking") {
    // Match the SSR pending shell — render nothing until we know the session.
    return null;
  }

  if (state.status === "signedOut") {
    const { pathname, search: searchStr, hash } = window.location;
    const redirectTo = `${pathname}${searchStr}${hash}`;
    const search: { redirect: string; message?: string } = { redirect: redirectTo };
    if (pathname.startsWith("/dashboard/new")) {
      const type = new URLSearchParams(searchStr).get("type");
      const labelByType: Record<string, string> = {
        ebook: "eBook",
        ai_prompt_pack: "AI Prompt Pack",
        printable_journal: "Digital Journal",
        financial_planner: "Financial Planner",
      };
      const label = type ? labelByType[type] : undefined;
      search.message = label
        ? `Sign in to continue uploading your ${label} — we'll bring you right back to the upload page.`
        : "Sign in to continue your upload — we'll bring you right back to where you left off.";
    }
    return <Navigate to="/auth" search={search} replace />;
  }

  return <Outlet />;
}
