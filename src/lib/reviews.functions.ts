import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type ReviewSort = "helpful" | "recent" | "top";

export type ReviewRow = {
  id: string;
  product_id: string;
  user_id: string | null;
  reviewer_name: string;
  reviewer_avatar: string | null;
  rating: number;
  title: string | null;
  body: string;
  verified_purchase: boolean;
  helpful_count: number;
  photo_url: string | null;
  photos: string[];
  created_at: string;
};

export type ReviewSummary = {
  count: number;
  average: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  reviews: ReviewRow[];
};

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function signPhotos(rows: ReviewRow[]): Promise<ReviewRow[]> {
  if (rows.length === 0) return rows;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load additional photos from the review_photos table.
    const { data: photoRows } = await supabaseAdmin
      .from("review_photos" as any)
      .select("review_id,storage_path,sort_order")
      .in(
        "review_id",
        rows.map((r) => r.id),
      )
      .order("sort_order", { ascending: true });
    const extras = new Map<string, string[]>();
    for (const p of (photoRows as any[]) ?? []) {
      const arr = extras.get(p.review_id) ?? [];
      arr.push(p.storage_path);
      extras.set(p.review_id, arr);
    }

    async function sign(path: string): Promise<string | null> {
      if (/^https?:\/\//.test(path)) return path;
      const { data } = await supabaseAdmin.storage
        .from("review-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      return data?.signedUrl ?? null;
    }

    const out = await Promise.all(
      rows.map(async (r) => {
        // Prefer review_photos rows; fall back to legacy single photo_url.
        const paths = extras.get(r.id) ?? (r.photo_url ? [r.photo_url] : []);
        const signed = (await Promise.all(paths.map(sign))).filter(
          (u): u is string => !!u,
        );
        return {
          ...r,
          photo_url: signed[0] ?? null,
          photos: signed,
        };
      }),
    );
    return out;
  } catch {
    return rows.map((r) => ({ ...r, photo_url: null, photos: [] }));
  }
}

export const listReviews = createServerFn({ method: "GET" })
  .inputValidator((input: { productId: string; sort?: ReviewSort }) => input)
  .handler(async ({ data }): Promise<ReviewSummary> => {
    const sb = publicClient();
    const sort = data.sort ?? "helpful";
    let query = sb
      .from("product_reviews")
      .select(
        "id,product_id,user_id,reviewer_name,reviewer_avatar,rating,title,body,verified_purchase,helpful_count,photo_url,created_at",
      )
      .eq("product_id", data.productId)
      .limit(50);
    if (sort === "recent") {
      query = query.order("created_at", { ascending: false });
    } else if (sort === "top") {
      query = query
        .order("rating", { ascending: false })
        .order("created_at", { ascending: false });
    } else {
      query = query
        .order("helpful_count", { ascending: false })
        .order("created_at", { ascending: false });
    }
    const { data: rows, error } = await query;
    if (error) throw error;
    const withPhotos = ((rows ?? []) as any[]).map((r) => ({ ...r, photos: [] as string[] })) as ReviewRow[];
    const reviews = await signPhotos(withPhotos);
    const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of reviews) {
      breakdown[r.rating as 1 | 2 | 3 | 4 | 5] += 1;
      sum += r.rating;
    }
    return {
      count: reviews.length,
      average: reviews.length ? sum / reviews.length : 0,
      breakdown,
      reviews,
    };
  });


export const createReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      productId: string;
      rating: number;
      title?: string;
      body: string;
      photoPath?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    if (data.rating < 1 || data.rating > 5) throw new Error("Invalid rating");
    if (!data.body || data.body.trim().length < 4) throw new Error("Review too short");
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name,avatar_url")
      .eq("id", userId)
      .maybeSingle();
    const { data: purchase } = await supabase
      .from("order_items")
      .select("id, orders!inner(buyer_user_id,status)")
      .eq("product_id", data.productId)
      .limit(1)
      .maybeSingle();
    const verified = !!purchase;
    const { error } = await supabase.from("product_reviews").insert({
      product_id: data.productId,
      user_id: userId,
      reviewer_name: profile?.display_name ?? "AurumVault reader",
      reviewer_avatar: profile?.avatar_url ?? null,
      rating: data.rating,
      title: data.title ?? null,
      body: data.body.trim(),
      verified_purchase: verified,
      photo_url: data.photoPath ?? null,
    });
    if (error) throw error;
    return { ok: true, verified };
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reviewId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("product_reviews")
      .delete()
      .eq("id", data.reviewId)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const toggleHelpful = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reviewId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("review_helpful_votes")
      .select("review_id")
      .eq("review_id", data.reviewId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("review_helpful_votes")
        .delete()
        .eq("review_id", data.reviewId)
        .eq("user_id", userId);
      return { helpful: false };
    }
    await supabase.from("review_helpful_votes").insert({
      review_id: data.reviewId,
      user_id: userId,
    });
    return { helpful: true };
  });
