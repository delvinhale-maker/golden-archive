import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID = z.string().uuid();

export const listWishlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("wishlists")
      .select(
        "product_id, marketplace_products(id,title,category,price_cents,cover_url,seller_id,description,ai_review_status,ai_review_score,created_at)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((r) => r.marketplace_products)
      .map((r) => r.marketplace_products as unknown as {
        id: string;
        title: string;
        category: string;
        price_cents: number;
        cover_url: string | null;
        seller_id: string;
        description: string | null;
        ai_review_status: string | null;
        ai_review_score: number | null;
        created_at: string;
      });
  });

export const listWishlistIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("wishlists").select("product_id");
    return (data ?? []).map((r) => r.product_id as string);
  });

export const addWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { productId: string }) => ({ productId: UUID.parse(d.productId) }))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("wishlists")
      .insert({ user_id: context.userId, product_id: data.productId });
    return { ok: true };
  });

export const removeWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { productId: string }) => ({ productId: UUID.parse(d.productId) }))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("wishlists")
      .delete()
      .eq("user_id", context.userId)
      .eq("product_id", data.productId);
    return { ok: true };
  });
