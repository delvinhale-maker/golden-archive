import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioEnabled } from "./feature-flags.middleware";
import type { CreatorStudioProductPreview } from "./schema";

const SITE_URL = "https://www.aurumvault.store";

type MarketplaceProductRow = {
  id: string;
  title: string;
  cover_url: string | null;
  description: string;
  price_cents: number;
  slug: string;
  creator_name: string | null;
};

/**
 * Safe adapter: AurumVault Creator Studio never reads from
 * marketplace_products directly outside this function. It maps only the
 * fields a project actually needs to preload (title/cover/price/URL/creator
 * identity) into a small, stable preview shape -- nothing here duplicates
 * product truth into Creator Studio's own tables. There is no canonical
 * screenshots/gallery table on marketplace_products (verified against
 * src/integrations/supabase/types.ts), so screenshots are always supplied
 * fresh by the creator inside the wizard, never preloaded from a product.
 */
export function toProductPreview(row: MarketplaceProductRow): CreatorStudioProductPreview {
  return {
    productId: row.id,
    title: row.title,
    coverUrl: row.cover_url,
    description: row.description,
    priceCents: row.price_cents,
    destinationUrl: `${SITE_URL}/products/${row.slug}`,
    creatorName: row.creator_name,
  };
}

/** Lists the caller's own published products, for the "Use an AurumVault Product" wizard step. */
export const listOwnProductsForCreatorStudioFn = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudioProductPreview[]> => {
    const { data, error } = await context.supabase
      .from("marketplace_products")
      .select("id,title,cover_url,description,price_cents,slug,creator_name")
      .eq("seller_id", context.userId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error("Couldn't load your products");
    return (data ?? []).map(toProductPreview);
  });
