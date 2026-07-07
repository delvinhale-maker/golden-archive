import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ProductPreviewImage = {
  id: string;
  pageOrder: number;
  imageUrl: string;
  altText: string | null;
};

/**
 * List pre-rendered, watermarked preview pages for a published product.
 * Read publicly via the anon SELECT policy on `product_previews` — the
 * policy itself restricts rows to published + approved products, so this
 * cannot leak drafts.
 */
export const listProductPreviews = createServerFn({ method: "GET" })
  .inputValidator((input: { productId: string }) => {
    if (!input?.productId || typeof input.productId !== "string") {
      throw new Error("productId is required");
    }
    return input;
  })
  .handler(async ({ data }): Promise<ProductPreviewImage[]> => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows, error } = await supabase
      .from("product_previews")
      .select("id, page_order, image_url, alt_text")
      .eq("product_id", data.productId)
      .order("page_order", { ascending: true });
    if (error) {
      console.error("[listProductPreviews]", error);
      return [];
    }
    return (rows ?? []).map((r) => ({
      id: r.id,
      pageOrder: r.page_order,
      imageUrl: r.image_url,
      altText: r.alt_text,
    }));
  });
