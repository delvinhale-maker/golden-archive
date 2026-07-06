import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BUMPS = 3;

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type OrderBump = {
  id: string;
  productId: string;
  bumpProductId: string;
  discountPercent: number;
  sortOrder: number;
  isActive: boolean;
  bump: {
    id: string;
    title: string;
    priceCents: number;
    coverUrl: string | null;
  };
};

export const listOrderBumpsForProduct = createServerFn({ method: "GET" })
  .inputValidator((input: { productId: string }) => {
    if (!UUID_RE.test(input.productId)) throw new Error("Invalid productId");
    return input;
  })
  .handler(async ({ data }): Promise<OrderBump[]> => {
    const sb = publicClient();
    const { data: rows } = await sb
      .from("product_order_bumps" as any)
      .select("id,product_id,bump_product_id,discount_percent,sort_order,is_active")
      .eq("product_id", data.productId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(MAX_BUMPS);
    const bumps = (rows as any[]) ?? [];
    if (bumps.length === 0) return [];
    const ids = bumps.map((b) => b.bump_product_id);
    const { data: prods } = await sb
      .from("marketplace_products")
      .select("id,title,price_cents,cover_url,status,published")
      .in("id", ids);
    const byId = new Map(
      (prods ?? [])
        .filter((p) => p.status === "approved" && p.published)
        .map((p) => [p.id, p]),
    );
    return bumps
      .filter((b) => byId.has(b.bump_product_id))
      .map((b) => {
        const p = byId.get(b.bump_product_id)!;
        return {
          id: b.id,
          productId: b.product_id,
          bumpProductId: b.bump_product_id,
          discountPercent: b.discount_percent,
          sortOrder: b.sort_order,
          isActive: b.is_active,
          bump: {
            id: p.id,
            title: p.title,
            priceCents: p.price_cents,
            coverUrl: p.cover_url ?? null,
          },
        };
      });
  });

export const listMyOrderBumps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string }) => {
    if (!UUID_RE.test(input.productId)) throw new Error("Invalid productId");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: bumps } = await context.supabase
      .from("product_order_bumps" as any)
      .select("id,product_id,bump_product_id,discount_percent,sort_order,is_active")
      .eq("product_id", data.productId)
      .eq("seller_id", context.userId)
      .order("sort_order", { ascending: true });
    return (bumps as any[]) ?? [];
  });

export const listMyProductsForBumpPicker = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { excludeProductId: string }) => {
    if (!UUID_RE.test(input.excludeProductId)) throw new Error("Invalid productId");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("marketplace_products")
      .select("id,title,price_cents,cover_url,status,published")
      .eq("seller_id", context.userId)
      .neq("id", data.excludeProductId)
      .order("created_at", { ascending: false })
      .limit(50);
    return (rows ?? []).filter((r) => r.status === "approved");
  });

export const upsertOrderBump = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      productId: string;
      bumpProductId: string;
      discountPercent: number;
      sortOrder: number;
    }) => {
      if (!UUID_RE.test(input.productId)) throw new Error("Invalid productId");
      if (!UUID_RE.test(input.bumpProductId)) throw new Error("Invalid bumpProductId");
      if (input.productId === input.bumpProductId) throw new Error("Cannot bump self");
      if (input.discountPercent < 0 || input.discountPercent > 90) {
        throw new Error("Discount must be 0–90%");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    // Verify both products belong to the seller
    const { data: prods } = await context.supabase
      .from("marketplace_products")
      .select("id,seller_id")
      .in("id", [data.productId, data.bumpProductId]);
    if (
      !prods ||
      prods.length !== 2 ||
      prods.some((p) => p.seller_id !== context.userId)
    ) {
      throw new Error("Both products must be yours");
    }

    // Enforce max bumps per product
    const { count } = await context.supabase
      .from("product_order_bumps" as any)
      .select("id", { count: "exact", head: true })
      .eq("product_id", data.productId)
      .neq("bump_product_id", data.bumpProductId);
    if ((count ?? 0) >= MAX_BUMPS) {
      throw new Error(`You can only add up to ${MAX_BUMPS} bumps per product`);
    }

    const { error } = await context.supabase
      .from("product_order_bumps" as any)
      .upsert(
        {
          product_id: data.productId,
          bump_product_id: data.bumpProductId,
          seller_id: context.userId,
          discount_percent: data.discountPercent,
          sort_order: data.sortOrder,
          is_active: true,
        },
        { onConflict: "product_id,bump_product_id" },
      );
    if (error) throw error;
    return { ok: true as const };
  });

export const deleteOrderBump = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bumpId: string }) => {
    if (!UUID_RE.test(input.bumpId)) throw new Error("Invalid bumpId");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_order_bumps" as any)
      .delete()
      .eq("id", data.bumpId)
      .eq("seller_id", context.userId);
    if (error) throw error;
    return { ok: true as const };
  });
