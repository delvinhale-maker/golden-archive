import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "seller" | "buyer";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  return {
    user,
    roles,
    loading,
    isAdmin: roles.includes("admin"),
    isSeller: roles.includes("seller"),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
}
