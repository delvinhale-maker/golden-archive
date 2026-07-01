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
    image:
      r.cover_url && r.cover_url.trim().length > 0
        ? r.cover_url
        : `av:${cat}:0`,
    bestseller: sponsored,
    creator: { id: r.seller_id, name: "Illustrious Capital™", verified: true },
  };
}

export type HomeRows = {
  newReleases: Product[];
  recommended: Product[];
  sponsored: Product[];
};

async function attachRatings(
  supa: ReturnType<typeof serverSupabase>,
  products: Product[],
): Promise<Product[]> {
  const ids = products.map((p) => p.id);
  if (ids.length === 0) return products;
  const { data } = await supa
    .from("product_reviews")
    .select("product_id,rating")
    .in("product_id", ids);
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const row of (data ?? []) as Array<{ product_id: string; rating: number }>) {
    const cur = buckets.get(row.product_id) ?? { sum: 0, n: 0 };
    cur.sum += row.rating;
    cur.n += 1;
    buckets.set(row.product_id, cur);
  }
  return products.map((p) => {
    const b = buckets.get(p.id);
    if (!b || b.n === 0) return p;
    return { ...p, rating: Math.round((b.sum / b.n) * 10) / 10, reviewCount: b.n };
  });
}

export const getHomeRows = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeRows> => {
    try {
      // Use service-role admin client to bypass any table-level GRANT/RLS quirks
      // (the `featured` column has caused permission-denied errors with the anon
      // key even though public read policies exist).
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const supa = supabaseAdmin;
      const { data, error } = await supa
        .from("marketplace_products")
        .select(
          "id,title,category,price_cents,compare_at_price_cents,cover_url,seller_id,created_at,featured",
        )
        .eq("status", "approved")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) console.error("[getHomeRows] db error:", error.message);

      const rows = (data ?? []) as Array<Row & { featured: boolean | null }>;
      // Fallback when no products at all: empty arrays (nothing to show).
      if (rows.length === 0) {
        return { newReleases: [], recommended: [], sponsored: [] };
      }

      // Full catalog fallback (up to 8) used when a row is empty or too thin.
      const allProducts = rows.slice(0, 8).map((r) => toProduct(r));

      // New Releases: newest 8; fall back to full catalog when < 3.
      let newReleases = rows.slice(0, 8).map((r) => toProduct(r));
      if (newReleases.length < 3) newReleases = allProducts;

      // Sponsored: products flagged featured; fall back to full catalog.
      let sponsored = rows
        .filter((r) => r.featured === true)
        .map((r) => toProduct(r, true));
      if (sponsored.length === 0) sponsored = allProducts;

      // Recommended: rank by paid-sales count, then by created_at; fallback to all.
      const ids = rows.map((r) => r.id);
      const { data: itemRows } = await supa
        .from("order_items")
        .select("product_id, orders!inner(status)")
        .in("product_id", ids)
        .eq("orders.status", "paid");
      const counts = new Map<string, number>();
      for (const it of (itemRows ?? []) as Array<{ product_id: string }>) {
        counts.set(it.product_id, (counts.get(it.product_id) ?? 0) + 1);
      }
      const hasPurchaseHistory = counts.size > 0;
      let recommended = hasPurchaseHistory
        ? [...rows]
            .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
            .slice(0, 8)
            .map((r) => toProduct(r))
        : allProducts;
      if (recommended.length === 0) recommended = allProducts;
      const [nrR, spR, recR] = await Promise.all([
        attachRatings(supa, newReleases),
        attachRatings(supa, sponsored),
        attachRatings(supa, recommended),
      ]);
      return { newReleases: nrR, recommended: recR, sponsored: spR };
    } catch (e) {
      console.error("[getHomeRows] failed:", e);
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
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const supa = supabaseAdmin;

        .from("marketplace_products")
        .select("id,title,category,price_cents,compare_at_price_cents,cover_url,seller_id,created_at")
        .in("id", data.ids)
        .eq("status", "approved")
        .eq("published", true);
      const byId = new Map(((rows ?? []) as Row[]).map((r) => [r.id, toProduct(r)]));
      // Preserve requested order
      const ordered = data.ids.map((id) => byId.get(id)).filter(Boolean) as Product[];
      return await attachRatings(supa, ordered);
    } catch {
      return [];
    }
  });
