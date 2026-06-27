import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReferralStats = {
  code: string;
  signups: number;
  creditedFirstOrders: number;
  creditedRevenueCents: number;
  recent: Array<{
    id: string;
    amount_cents: number;
    currency: string;
    created_at: string;
    status: string;
  }>;
};

export const getReferralStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralStats> => {
    const { supabase, userId } = context;
    const code = userId.replace(/-/g, "").slice(0, 8).toUpperCase();

    const [signupsRes, creditedRes, ordersRes] = await Promise.all([
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_user_id", userId),
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_user_id", userId)
        .not("first_order_id", "is", null),
      supabase
        .from("orders")
        .select("id, amount_cents, currency, created_at, status")
        .eq("referrer_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const orders = ordersRes.data ?? [];
    const paid = orders.filter((o) =>
      ["paid", "completed", "succeeded", "complete"].includes((o.status ?? "").toLowerCase()),
    );
    const revenue = paid.reduce((sum, o) => sum + (o.amount_cents ?? 0), 0);

    return {
      code,
      signups: signupsRes.count ?? 0,
      creditedFirstOrders: creditedRes.count ?? 0,
      creditedRevenueCents: revenue,
      recent: orders.map((o) => ({
        id: o.id,
        amount_cents: o.amount_cents ?? 0,
        currency: o.currency ?? "usd",
        created_at: o.created_at,
        status: o.status ?? "",
      })),
    };
  });
