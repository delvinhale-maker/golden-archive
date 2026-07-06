import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LicenseType = "personal" | "commercial" | "extended";

export type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  license_type: LicenseType | null;
  price_cents: number;
  pay_what_you_want: boolean;
  min_price_cents: number | null;
  file_path: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  is_active: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serverPublicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/** Public: list active variants of a published product (buyer-facing). */
export const listPublicVariants = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ productId: z.string().regex(UUID_RE) }).parse(input),
  )
  .handler(async ({ data }): Promise<ProductVariant[]> => {
    const supa = serverPublicClient();
    const { data: rows } = await supa
      .from("product_variants" as any)
      .select(
        "id,product_id,name,description,license_type,price_cents,pay_what_you_want,min_price_cents,file_path,file_size_bytes,sort_order,is_active",
      )
      .eq("product_id", data.productId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    // Never expose file_path publicly
    return ((rows ?? []) as any[]).map((r) => ({
      ...(r as ProductVariant),
      file_path: null,
      file_size_bytes: r.file_size_bytes ?? null,
    })) as ProductVariant[];
  });

/** Creator: list variants (including inactive) for own product. */
export const listMyVariants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ productId: z.string().regex(UUID_RE) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ProductVariant[]> => {
    const { supabase, userId } = context;
    const { data: prod } = await supabase
      .from("marketplace_products")
      .select("seller_id")
      .eq("id", data.productId)
      .maybeSingle();
    if (!prod || prod.seller_id !== userId) throw new Error("Forbidden");
    const { data: rows, error } = await supabase
      .from("product_variants" as any)
      .select("*")
      .eq("product_id", data.productId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as unknown) as ProductVariant[];
  });


const upsertSchema = z.object({
  productId: z.string().regex(UUID_RE),
  variants: z
    .array(
      z.object({
        id: z.string().regex(UUID_RE).optional(),
        name: z.string().min(1).max(80),
        description: z.string().max(2000).nullish(),
        license_type: z.enum(["personal", "commercial", "extended"]).nullish(),
        price_cents: z.number().int().min(0).max(1_000_000),
        pay_what_you_want: z.boolean().default(false),
        min_price_cents: z.number().int().min(0).max(1_000_000).nullish(),
        file_path: z.string().max(500).nullish(),
        file_size_bytes: z.number().int().min(0).nullish(),
        sort_order: z.number().int().min(0).max(9999).default(0),
        is_active: z.boolean().default(true),
      }),
    )
    .max(20),
});

/** Creator: replace variants for own product (sync-style upsert + delete missing). */
export const saveMyVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prod } = await supabase
      .from("marketplace_products")
      .select("seller_id")
      .eq("id", data.productId)
      .maybeSingle();
    if (!prod || prod.seller_id !== userId) throw new Error("Forbidden");

    const keepIds: string[] = [];
    for (const v of data.variants) {
      const payload: any = {
        product_id: data.productId,
        name: v.name.trim(),
        description: v.description ?? null,
        license_type: v.license_type ?? null,
        price_cents: v.pay_what_you_want ? (v.min_price_cents ?? 0) : v.price_cents,
        pay_what_you_want: v.pay_what_you_want,
        min_price_cents: v.pay_what_you_want ? (v.min_price_cents ?? 0) : null,
        file_path: v.file_path ?? null,
        file_size_bytes: v.file_size_bytes ?? null,
        sort_order: v.sort_order,
        is_active: v.is_active,
      };
      if (v.id) {
        const { error } = await supabase
          .from("product_variants" as any)
          .update(payload)
          .eq("id", v.id);
        if (error) throw new Error(error.message);
        keepIds.push(v.id);
      } else {
        const { data: ins, error } = await supabase
          .from("product_variants" as any)
          .insert(payload)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        keepIds.push((ins as any).id);
      }
    }

    // Delete removed rows
    let del = supabase
      .from("product_variants" as any)
      .delete()
      .eq("product_id", data.productId);
    if (keepIds.length > 0) del = del.not("id", "in", `(${keepIds.join(",")})`);
    await del;

    return { ok: true, count: keepIds.length };
  });
