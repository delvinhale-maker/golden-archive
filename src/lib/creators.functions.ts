import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type CreatorSummary = {
  userId: string;
  brandName: string;
  brandSlug: string;
  pitch: string | null;
  country: string | null;
  categories: string[] | null;
  avatarUrl: string | null;
  coverUrl: string | null;
};

// Public list of approved creators with a brand slug.
export const getApprovedCreators = createServerFn({ method: "GET" }).handler(
  async (): Promise<CreatorSummary[]> => {
    const supa = publicSupabase();
    const { data: apps } = await supa
      .from("seller_applications")
      .select(
        "user_id,brand_name,brand_slug,pitch,country,categories,cover_url",
      )
      .eq("status", "approved")
      .not("brand_slug", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    const rows = (apps ?? []) as Array<{
      user_id: string;
      brand_name: string | null;
      brand_slug: string | null;
      pitch: string | null;
      country: string | null;
      categories: string[] | null;
      cover_url: string | null;
    }>;
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.user_id);
    const { data: profiles } = await supa
      .from("profiles")
      .select("id,display_name,avatar_url")
      .in("id", ids);
    const profMap = new Map<string, { name: string | null; avatar: string | null }>();
    for (const p of (profiles ?? []) as Array<{
      id: string;
      display_name: string | null;
      avatar_url: string | null;
    }>) {
      profMap.set(p.id, { name: p.display_name, avatar: p.avatar_url });
    }

    return rows
      .filter((r) => r.brand_slug)
      .map((r) => {
        const prof = profMap.get(r.user_id);
        return {
          userId: r.user_id,
          brandName: r.brand_name ?? prof?.name ?? "Creator",
          brandSlug: r.brand_slug!,
          pitch: r.pitch,
          country: r.country,
          categories: r.categories,
          avatarUrl: prof?.avatar ?? null,
          coverUrl: r.cover_url,
        };
      });
  },
);

// Product counts grouped by category (published/live products only).
export const getCategoryCounts = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, number>> => {
    const supa = publicSupabase();
    const { data } = await supa
      .from("marketplace_products")
      .select("category")
      .limit(5000);
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as Array<{ category: string | null }>) {
      if (!row.category) continue;
      counts[row.category] = (counts[row.category] ?? 0) + 1;
    }
    return counts;
  },
);
