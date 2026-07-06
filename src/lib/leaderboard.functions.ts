import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const UUID = z.string().uuid();

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type LeaderboardRow = {
  rank: number;
  sellerId: string;
  name: string;
  slug: string | null;
  salesCount: number;
  grossCents: number;
};

function monthStart(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return d.toISOString();
}

// Public leaderboard — top 10 creators this calendar month.
export const getCreatorLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeaderboardRow[]> => {
    const supa = publicSupabase();
    const since = monthStart();

    // Grab paid order items this month.
    const { data: items } = await supa
      .from("order_items")
      .select("seller_id,unit_amount_cents,orders!inner(status,created_at)")
      .gte("orders.created_at", since)
      .eq("orders.status", "paid")
      .limit(5000);

    const buckets = new Map<string, { sales: number; gross: number }>();
    for (const row of (items ?? []) as Array<{
      seller_id: string;
      unit_amount_cents: number;
    }>) {
      const cur = buckets.get(row.seller_id) ?? { sales: 0, gross: 0 };
      cur.sales += 1;
      cur.gross += row.unit_amount_cents;
      buckets.set(row.seller_id, cur);
    }
    const ranked = Array.from(buckets.entries())
      .map(([sellerId, v]) => ({ sellerId, ...v }))
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 10);

    if (ranked.length === 0) return [];

    const ids = ranked.map((r) => r.sellerId);
    const [{ data: profiles }, { data: apps }] = await Promise.all([
      supa.from("profiles").select("id,display_name").in("id", ids),
      supa
        .from("seller_applications")
        .select("user_id,brand_slug,brand_name")
        .in("user_id", ids),
    ]);
    const nameMap = new Map<string, string>();
    const slugMap = new Map<string, string | null>();
    for (const p of (profiles ?? []) as Array<{ id: string; display_name: string | null }>) {
      nameMap.set(p.id, p.display_name ?? "Creator");
    }
    for (const a of (apps ?? []) as Array<{
      user_id: string;
      brand_slug: string | null;
      brand_name: string | null;
    }>) {
      if (a.brand_name) nameMap.set(a.user_id, a.brand_name);
      slugMap.set(a.user_id, a.brand_slug ?? null);
    }

    return ranked.map((r, i) => ({
      rank: i + 1,
      sellerId: r.sellerId,
      name: nameMap.get(r.sellerId) ?? "Creator",
      slug: slugMap.get(r.sellerId) ?? null,
      salesCount: r.sales,
      grossCents: r.gross,
    }));
  },
);

// ---------------------------------------------------------------------------
// Badges — computed on demand from order_items
// ---------------------------------------------------------------------------
export type BadgeKey =
  | "first_sale"
  | "ten_sales"
  | "hundred_sales"
  | "one_k_earned"
  | "ten_k_earned"
  | "top_creator";

export type Badge = {
  key: BadgeKey;
  label: string;
  earned: boolean;
  hint: string;
};

export const getCreatorBadges = createServerFn({ method: "GET" })
  .inputValidator((d: { sellerId: string }) => ({ sellerId: UUID.parse(d.sellerId) }))
  .handler(async ({ data }): Promise<Badge[]> => {
    const supa = publicSupabase();
    const { data: items } = await supa
      .from("order_items")
      .select("unit_amount_cents,seller_amount_cents,orders!inner(status)")
      .eq("seller_id", data.sellerId)
      .eq("orders.status", "paid")
      .limit(10000);

    const rows = (items ?? []) as Array<{
      unit_amount_cents: number;
      seller_amount_cents: number;
    }>;
    const salesCount = rows.length;
    const earnedCents = rows.reduce((s, r) => s + r.seller_amount_cents, 0);

    // Top creator check — has ever been in top 3 this month or prior?
    const top = await getCreatorLeaderboard();
    const topCreator = top.slice(0, 3).some((r) => r.sellerId === data.sellerId);

    return [
      {
        key: "first_sale",
        label: "First Sale",
        earned: salesCount >= 1,
        hint: "Complete 1 sale",
      },
      {
        key: "ten_sales",
        label: "10 Sales",
        earned: salesCount >= 10,
        hint: "Complete 10 sales",
      },
      {
        key: "hundred_sales",
        label: "100 Sales",
        earned: salesCount >= 100,
        hint: "Complete 100 sales",
      },
      {
        key: "one_k_earned",
        label: "$1K Earned",
        earned: earnedCents >= 100_000,
        hint: "Earn $1,000 net",
      },
      {
        key: "ten_k_earned",
        label: "$10K Earned",
        earned: earnedCents >= 1_000_000,
        hint: "Earn $10,000 net",
      },
      {
        key: "top_creator",
        label: "Top Creator",
        earned: topCreator,
        hint: "Reach top 3 this month",
      },
    ];
  });
