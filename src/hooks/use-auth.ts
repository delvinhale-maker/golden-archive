import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "seller" | "buyer";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRoles(uid: string) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (mounted) setRoles((data ?? []).map((r) => r.role as AppRole));
    }

    async function syncSession() {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        await loadRoles(nextUser.id);
      } else {
        setRoles([]);
      }
      if (mounted) setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => void syncSession(), 0);
      } else {
        setRoles([]);
        setLoading(false);
      }
    });

    void syncSession();

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
