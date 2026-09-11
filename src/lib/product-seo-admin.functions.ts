import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CLEAN_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const nullableText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const trimmed = value.trim();
      return trimmed || null;
    })
    .refine((value) => value == null || value.length <= max, {
      message: `must be ${max} characters or fewer`,
    });

const keywordList = z
  .union([z.array(z.string()), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null) return [] as string[];
    const raw = Array.isArray(value) ? value : value.split(",");
    return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))].slice(0, 50);
  });

const TargetSchema = z
  .object({
    product_id: z.string().uuid().optional(),
    product_slug: z.string().trim().regex(CLEAN_SLUG_RE).optional(),
  })
  .refine((value) => Boolean(value.product_id || value.product_slug), {
    message: "product_id or product_slug is required",
    path: ["product_id"],
  });

const SaveSchema = TargetSchema.and(
  z.object({
    seo_title: nullableText(200),
    seo_description: nullableText(500),
    seo_focus_keyword: nullableText(200),
    seo_secondary_keywords: keywordList,
    seo_image_alt: nullableText(300),
    seo_og_title: nullableText(200),
    seo_og_description: nullableText(500),
    seo_robots_index: z.boolean().optional(),
    seo_robots_follow: z.boolean().optional(),
  }),
);

export type ProductSeoTarget = {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  published: boolean;
};

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("forbidden");
}

async function resolveTarget(input: z.infer<typeof TargetSchema>): Promise<ProductSeoTarget> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin
    .from("marketplace_products")
    .select("id,title,slug,status,published");
  if (input.product_id) query = query.eq("id", input.product_id);
  if (input.product_slug) query = query.eq("slug", input.product_slug);
  const { data, error } = await query.limit(2);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("No product matched that product_id/product_slug");
  }
  if (data.length !== 1) {
    throw new Error("The selector matched more than one product; use product_id");
  }
  const row = data[0];
  return {
    id: row.id,
    title: row.title,
    slug: row.slug ?? null,
    status: row.status,
    published: row.published,
  };
}

export const resolveProductSeoTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TargetSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProductSeoTarget> => {
    await assertAdmin(context.userId);
    return resolveTarget(data);
  });

export const saveProductSeoMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProductSeoTarget> => {
    await assertAdmin(context.userId);
    const product = await resolveTarget({
      product_id: data.product_id,
      product_slug: data.product_slug,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {
      seo_updated_at: new Date().toISOString(),
    };
    if (data.seo_title !== undefined) patch.seo_title = data.seo_title;
    if (data.seo_description !== undefined) patch.seo_description = data.seo_description;
    if (data.seo_focus_keyword !== undefined) patch.seo_focus_keyword = data.seo_focus_keyword;
    if (data.seo_secondary_keywords !== undefined) {
      patch.seo_secondary_keywords = data.seo_secondary_keywords;
    }
    if (data.seo_image_alt !== undefined) patch.seo_image_alt = data.seo_image_alt;
    if (data.seo_og_title !== undefined) patch.seo_og_title = data.seo_og_title;
    if (data.seo_og_description !== undefined) patch.seo_og_description = data.seo_og_description;
    if (data.seo_robots_index !== undefined) patch.seo_robots_index = data.seo_robots_index;
    if (data.seo_robots_follow !== undefined) patch.seo_robots_follow = data.seo_robots_follow;

    // Generated Supabase types are updated in the same release, but keep this
    // compatibility cast scoped to this single SEO-only server write so stale
    // generated clients cannot widen the browser write surface.
    const { error } = await (supabaseAdmin.from("marketplace_products") as any)
      .update(patch)
      .eq("id", product.id);
    if (error) throw new Error(error.message);
    return product;
  });
