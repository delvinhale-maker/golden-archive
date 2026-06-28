import { supabase } from "@/integrations/supabase/client";

export type AffiliateSource = "amazon" | "walmart";

export type AffiliateProduct = {
  id: string;
  title: string;
  description: string;
  price: number;
  original_price: number | null;
  image_url: string;
  affiliate_url: string;
  source: AffiliateSource;
  category: string;
  badge: string | null;
  featured: boolean;
  active: boolean;
  created_at: string;
};

export const AFFILIATE_CATEGORIES = [
  "eBooks",
  "Finance",
  "Leadership",
  "Purpose",
  "Business",
  "Children",
  "Audio",
] as const;

export const SOURCE_LABEL: Record<AffiliateSource, string> = {
  amazon: "Amazon",
  walmart: "Walmart",
};

export async function fetchAffiliateProducts(opts?: {
  activeOnly?: boolean;
  featuredFirst?: boolean;
  limit?: number;
}): Promise<AffiliateProduct[]> {
  let q = supabase.from("affiliate_products").select("*");
  if (opts?.activeOnly !== false) q = q.eq("active", true);
  q = opts?.featuredFirst
    ? q.order("featured", { ascending: false }).order("created_at", { ascending: false })
    : q.order("created_at", { ascending: false });
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AffiliateProduct[];
}

/** Fire-and-forget click logging. Never blocks navigation. */
export function logAffiliateClick(p: AffiliateProduct, userId?: string | null) {
  try {
    void supabase.from("affiliate_clicks").insert({
      product_id: p.id,
      affiliate_url: p.affiliate_url,
      source: p.source,
      user_id: userId ?? null,
    });
  } catch {
    /* ignore */
  }
}

/** Map of product_id -> total click count (admin only — relies on SELECT policy). */
export async function fetchAffiliateClickCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("affiliate_clicks")
    .select("product_id");
  if (error) return {};
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { product_id: string }[]) {
    out[row.product_id] = (out[row.product_id] ?? 0) + 1;
  }
  return out;
}
