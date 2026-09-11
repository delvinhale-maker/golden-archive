import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const keywords = z
  .union([z.array(z.string()), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return [] as string[];
    if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  });

const text = (max: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .refine((value) => value == null || value.length <= max, {
      message: `must be ${max} characters or fewer`,
    });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const selectorFields = {
  product_id: z.string().trim().regex(UUID_RE, "product_id is not a valid product identifier").optional(),
  product_slug: z
    .string()
    .trim()
    .regex(SLUG_RE, "product_slug must be lowercase words separated by hyphens")
    .optional(),
};

const requireOneSelector = <T extends { product_id?: string; product_slug?: string }>(value: T) =>
  Boolean(value.product_id) !== Boolean(value.product_slug);

const SelectorSchema = z
  .object(selectorFields)
  .strict()
  .refine(requireOneSelector, {
    message: "exactly one of product_id or product_slug is required",
    path: ["product_id"],
  });

const InputSchema = z
  .object({
    ...selectorFields,
    seo_title: text(200),
    seo_description: text(500),
    seo_focus_keyword: text(300),
    seo_secondary_keywords: keywords,
    seo_image_alt: text(300),
    seo_og_title: text(300),
    seo_og_description: text(500),
    seo_robots_index: z.boolean().optional(),
    seo_robots_follow: z.boolean().optional(),
  })
  .strict()
  .refine(requireOneSelector, {
    message: "exactly one of product_id or product_slug is required",
    path: ["product_id"],
  });

export type ProductSeoTarget = {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  published: boolean;
};

export type SaveProductSeoResult = ProductSeoTarget;

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden: admin only");
}

async function resolveTarget(
  selector: z.output<typeof SelectorSchema>,
): Promise<ProductSeoTarget> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const columns = "id,title,slug,status,published";

  if (selector.product_id) {
    const { data: row, error } = await supabaseAdmin
      .from("marketplace_products")
      .select(columns)
      .eq("id", selector.product_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error(`No product exists with id ${selector.product_id}`);
    return {
      id: row.id,
      title: row.title,
      slug: row.slug ?? null,
      status: row.status,
      published: row.published,
    };
  }

  const slug = selector.product_slug ?? "";
  const { data: rows, error } = await supabaseAdmin
    .from("marketplace_products")
    .select(columns)
    .eq("slug", slug)
    .limit(2);
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) throw new Error(`No product exists with slug "${slug}"`);
  if (rows.length > 1) throw new Error(`Slug "${slug}" matched more than one product — use product_id`);
  return {
    id: rows[0].id,
    title: rows[0].title,
    slug: rows[0].slug ?? null,
    status: rows[0].status,
    published: rows[0].published,
  };
}

export const resolveProductSeoTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SelectorSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProductSeoTarget> => {
    await assertAdmin(context.supabase, context.userId);
    return resolveTarget(data);
  });

export const saveProductSeoMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<SaveProductSeoResult> => {
    await assertAdmin(context.supabase, context.userId);
    const product = await resolveTarget({
      product_id: data.product_id,
      product_slug: data.product_slug,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    type ProductUpdate = Partial<{
      seo_title: string | null;
      seo_description: string | null;
      seo_focus_keyword: string | null;
      seo_secondary_keywords: string[];
      seo_image_alt: string | null;
      seo_og_title: string | null;
      seo_og_description: string | null;
      seo_robots_index: boolean;
      seo_robots_follow: boolean;
    }> & { seo_updated_at: string };
    const seoUpdates: ProductUpdate = { seo_updated_at: new Date().toISOString() };
    if (data.seo_title !== undefined) seoUpdates.seo_title = data.seo_title || null;
    if (data.seo_description !== undefined)
      seoUpdates.seo_description = data.seo_description || null;
    if (data.seo_focus_keyword !== undefined)
      seoUpdates.seo_focus_keyword = data.seo_focus_keyword || null;
    if (data.seo_secondary_keywords !== undefined)
      seoUpdates.seo_secondary_keywords = data.seo_secondary_keywords;
    if (data.seo_image_alt !== undefined) seoUpdates.seo_image_alt = data.seo_image_alt || null;
    if (data.seo_og_title !== undefined) seoUpdates.seo_og_title = data.seo_og_title || null;
    if (data.seo_og_description !== undefined)
      seoUpdates.seo_og_description = data.seo_og_description || null;
    if (data.seo_robots_index !== undefined)
      seoUpdates.seo_robots_index = data.seo_robots_index;
    if (data.seo_robots_follow !== undefined)
      seoUpdates.seo_robots_follow = data.seo_robots_follow;

    const { error } = await supabaseAdmin
      .from("marketplace_products")
      .update(seoUpdates as never)
      .eq("id", product.id);
    if (error) throw new Error(error.message);
    return product;
  });