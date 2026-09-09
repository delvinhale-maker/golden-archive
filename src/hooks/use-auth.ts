import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "seller" | "buyer";

const HAS_SUPABASE_CLIENT_CONFIG = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

type AuthMode = "required" | "optional";

function useAuthState(mode: AuthMode) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(mode === "required" || HAS_SUPABASE_CLIENT_CONFIG);

  useEffect(() => {
    // Public storefront chrome can render without auth enhancements. This keeps
    // optional UI (header account state, seller/admin FABs) from taking down
    // public pages when client Supabase configuration is unavailable. Required
    // auth callers retain the existing fail-fast Supabase behavior.
    if (mode === "optional" && !HAS_SUPABASE_CLIENT_CONFIG) {
      setUser(null);
      setRoles([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function applySession(session: Session | null) {
      setLoading(true);
      if (!mounted) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", nextUser.id);
        if (!mounted) return;
        setRoles((data ?? []).map((r) => r.role as AppRole));
      } else {
        setRoles([]);
      }
      if (mounted) setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void applySession(session), 0);
    });

    supabase.auth.getSession().then(({ data }) => void applySession(data.session));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [mode]);

  return {
    user,
    roles,
    loading,
    isAdmin: roles.includes("admin"),
    isSeller: roles.includes("seller"),
    signOut: async () => {
      if (mode === "optional" && !HAS_SUPABASE_CLIENT_CONFIG) return;
      await supabase.auth.signOut();
    },
  };
}

/** Auth for application/protected surfaces. Missing Supabase config fails fast. */
export function useAuth() {
  return useAuthState("required");
}

/**
 * Auth enhancement for public storefront chrome. Missing client configuration
 * degrades to a signed-out state instead of throwing through the root boundary.
 */
export function useOptionalAuth() {
  return useAuthState("optional");
}
