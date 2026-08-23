import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { fetchCreatorInfoMap, type Product, type PublicCreatorRef } from "@/lib/marketplace.functions";
import { slugToLabel } from "@/lib/categories";

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

function toProduct(r: Row, sponsored = false, creator?: PublicCreatorRef): Product {
  const cat = slugToLabel(r.category);
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
    // Safe fallback mirrors dbRowToProduct's — fails to a generic, unverified
    // label rather than claiming a creator that wasn't actually looked up.
    creator: creator ?? { id: r.seller_id, name: "AurumVault", verified: false, isAurumVaultOwned: true },
  };
}

export type RowSource = "specific" | "fallback" | "empty";
export type HomeRowsDiagnostics = {
  totalApproved: number;
  featuredCount: number;
  purchaseHistoryCount: number;
  sources: { newReleases: RowSource; sponsored: RowSource; recommended: RowSource };
  counts: { newReleases: number; sponsored: number; recommended: number };
  generatedAt: string;
};

export type HomeRows = {
  newReleases: Product[];
  recommended: Product[];
  sponsored: Product[];
  diagnostics: HomeRowsDiagnostics;
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

// Deterministic intra-day rotation: advances fast enough that every product
// in the catalog passes through the visible window within a single 24h span.
// Tick interval = 24h / arr.length, so after `arr.length` ticks (== 24h) the
// rotation returns to its starting offset. SSR-safe (no per-request randomness).
function rotateDaily<T>(arr: T[], salt = 0): T[] {
  if (arr.length <= 1) return arr;
  const n = arr.length;
  const intervalMs = Math.max(1, Math.floor(86_400_000 / n));
  const tick = Math.floor(Date.now() / intervalMs);
  const offset = (((tick + salt) % n) + n) % n;
  return arr.slice(offset).concat(arr.slice(0, offset));
}


export const getHomeRows = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeRows> => {
    try {
      // Use the SAME publishable-key server client that Featured Products uses.
      // The admin client can fail at runtime when the injected key is not a
      // JWT, leaving these rows empty while Featured still renders.
      const supa = serverSupabase();
      const { data, error } = await supa
        .from("marketplace_products")
        .select(
          "id,title,category,price_cents,compare_at_price_cents,cover_url,seller_id,created_at,featured",
        )
        .eq("status", "approved")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) console.error("[getHomeRows] db error:", error.message);

      const rows = (data ?? []) as Array<Row & { featured: boolean | null }>;
      const featuredCount = rows.filter((r) => r.featured === true).length;
      const emptyDiag = (): HomeRowsDiagnostics => ({
        totalApproved: rows.length,
        featuredCount,
        purchaseHistoryCount: 0,
        sources: { newReleases: "empty", sponsored: "empty", recommended: "empty" },
        counts: { newReleases: 0, sponsored: 0, recommended: 0 },
        generatedAt: new Date().toISOString(),
      });
      if (rows.length === 0) {
        return { newReleases: [], recommended: [], sponsored: [], diagnostics: emptyDiag() };
      }

      // One batched lookup covering every seller across all three rows —
      // avoids fetching creator identity once per product.
      const creators = await fetchCreatorInfoMap(supa, rows.map((r) => r.seller_id));
      const withCreator = (r: Row, sponsored = false) => toProduct(r, sponsored, creators.get(r.seller_id));

      // Rotate the full catalog daily so every product cycles through the rows.
      const allProducts = rotateDaily(rows.map((r) => withCreator(r)), 0);

      // Just Dropped: strictly newest first (rows are already created_at desc).
      const newReleases = rows.map((r) => withCreator(r)).slice(0, 8);
      const newReleasesSource: RowSource = newReleases.length > 0 ? "specific" : "empty";

      // Sponsored: featured=true, rotated daily; fallback to full catalog rotation.
      const sponsoredSpecific = rotateDaily(
        rows.filter((r) => r.featured === true).map((r) => withCreator(r, true)),
        2,
      );
      const sponsored = (sponsoredSpecific.length > 0 ? sponsoredSpecific : allProducts).slice(0, 8);
      const sponsoredSource: RowSource =
        sponsoredSpecific.length > 0 ? "specific" : sponsored.length > 0 ? "fallback" : "empty";

      // Recommended: rank by paid-sales count; fallback to daily-rotated catalog.
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
      const recommended = hasPurchaseHistory
        ? [...rows]
            .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
            .map((r) => withCreator(r))
        : rotateDaily(rows.map((r) => withCreator(r)), 3);
      const recommendedFinal = recommended.slice(0, 8);
      const recommendedSource: RowSource = hasPurchaseHistory
        ? "specific"
        : recommendedFinal.length > 0
          ? "fallback"
          : "empty";

      const [nrR, spR, recR] = await Promise.all([
        attachRatings(supa, newReleases),
        attachRatings(supa, sponsored),
        attachRatings(supa, recommendedFinal),
      ]);
      const diagnostics: HomeRowsDiagnostics = {
        totalApproved: rows.length,
        featuredCount,
        purchaseHistoryCount: counts.size,
        sources: {
          newReleases: newReleasesSource,
          sponsored: sponsoredSource,
          recommended: recommendedSource,
        },
        counts: {
          newReleases: nrR.length,
          sponsored: spR.length,
          recommended: recR.length,
        },
        generatedAt: new Date().toISOString(),
      };
      return { newReleases: nrR, recommended: recR, sponsored: spR, diagnostics };
    } catch (e) {
      console.error("[getHomeRows] failed:", e);
      return {
        newReleases: [],
        recommended: [],
        sponsored: [],
        diagnostics: {
          totalApproved: 0,
          featuredCount: 0,
          purchaseHistoryCount: 0,
          sources: { newReleases: "empty", sponsored: "empty", recommended: "empty" },
          counts: { newReleases: 0, sponsored: 0, recommended: 0 },
          generatedAt: new Date().toISOString(),
        },
      };
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

      const idRows = (rows ?? []) as Row[];
      const creators = await fetchCreatorInfoMap(supa, idRows.map((r) => r.seller_id));
      const byId = new Map(idRows.map((r) => [r.id, toProduct(r, false, creators.get(r.seller_id))]));
      const ordered = data.ids.map((id) => byId.get(id)).filter(Boolean) as Product[];
      return await attachRatings(supa, ordered);
    } catch {
      return [];
    }
  });

