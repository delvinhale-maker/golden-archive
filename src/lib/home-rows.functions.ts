import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Product } from "@/lib/marketplace.functions";

const CAT_LABEL: Record<string, string> = {
  ebooks: "eBooks",
  courses: "Courses",
  templates: "Templates",
  audio: "Audio",
  finance: "Finance",
  leadership: "Leadership",
  purpose: "Purpose",
  business: "Business",
};

function serverSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

type Row = {
  id: string;
  title: string;
  category: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  cover_url: string | null;
  seller_id: string;
  created_at: string;
};

function toProduct(r: Row, sponsored = false): Product {
  const cat = CAT_LABEL[r.category?.toLowerCase()] ?? r.category ?? "eBooks";
  const compareAt =
    r.compare_at_price_cents != null && r.compare_at_price_cents > r.price_cents
      ? r.compare_at_price_cents / 100
      : undefined;
  return {
    id: r.id,
    title: r.title,
    category: cat,
    price: r.price_cents / 100,
    compareAtPrice: compareAt,
    rating: 0,
    reviewCount: 0,
    image: r.cover_url ?? `av:${cat}:0`,
    bestseller: sponsored,
    creator: { id: r.seller_id, name: "Illustrious Capital™", verified: true },
  };
}

export type HomeRows = {
  newReleases: Product[];
  recommended: Product[];
  sponsored: Product[];
};

export const getHomeRows = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeRows> => {
    try {
      const supa = serverSupabase();
      const { data } = await supa
        .from("marketplace_products")
        .select("id,title,category,price_cents,compare_at_price_cents,cover_url,seller_id,created_at")
        .eq("status", "approved")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(40);
      const rows = (data ?? []) as Row[];
      if (rows.length === 0) {
        return { newReleases: [], recommended: [], sponsored: [] };
      }
      // New Releases: 3 most recently added
      const newReleases = rows.slice(0, 3).map((r) => toProduct(r));
      // Sponsored: Kingdom Mind + M.O.V. (Illustrious Capital™ featured)
      const SPONSORED_TITLES = ["Kingdom Mind", "M.O.V. — Method of Verification"];
      const sponsored = SPONSORED_TITLES
        .map((t) => rows.find((r) => r.title === t))
        .filter((r): r is Row => Boolean(r))
        .map((r) => toProduct(r, true));
      // Recommended: top 3 bestsellers (proxy: oldest approved = most established)
      const recommended = [...rows]
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
        .slice(0, 3)
        .map((r) => toProduct(r));
      return { newReleases, recommended, sponsored };
    } catch {
      return { newReleases: [], recommended: [], sponsored: [] };
    }
  },
);

export const getProductsByIds = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string()).max(20) }).parse(input),
  )
  .handler(async ({ data }): Promise<Product[]> => {
    if (data.ids.length === 0) return [];
    try {
      const supa = serverSupabase();
      const { data: rows } = await supa
        .from("marketplace_products")
        .select("id,title,category,price_cents,compare_at_price_cents,cover_url,seller_id,created_at")
        .in("id", data.ids)
        .eq("status", "approved")
        .eq("published", true);
      const byId = new Map(((rows ?? []) as Row[]).map((r) => [r.id, toProduct(r)]));
      // Preserve requested order
      return data.ids.map((id) => byId.get(id)).filter(Boolean) as Product[];
    } catch {
      return [];
    }
  });
