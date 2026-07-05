import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyOrders } from "@/lib/account.functions";

/**
 * Returns the set of product IDs the signed-in user has already purchased.
 * Empty set when signed out or while loading. Safe to call from any component.
 */
export function useOwnedProductIds(): { owned: Set<string>; isLoading: boolean } {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const myOrders = useServerFn(getMyOrders);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const q = useQuery({
    queryKey: ["owned-product-ids"],
    queryFn: async () => {
      const orders = await myOrders();
      const ids = new Set<string>();
      for (const o of orders) for (const i of o.items) ids.add(i.product_id);
      return ids;
    },
    enabled: signedIn === true,
    staleTime: 60_000,
  });

  return {
    owned: q.data ?? new Set<string>(),
    isLoading: signedIn === null || q.isLoading,
  };
}

export function useOwnsProduct(productId: string | undefined): boolean {
  const { owned } = useOwnedProductIds();
  return !!productId && owned.has(productId);
}
