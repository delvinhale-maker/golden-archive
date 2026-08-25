/**
 * Server-only resolvers for AurumVault QR shortcuts (Phase 2).
 *
 * A shortcut lets an owner create a QR that points at their own AurumVault
 * storefront or one of their own products without typing a URL. The
 * destination is always resolved HERE, from data the caller provably owns —
 * a client can only ever pass a product id, never a URL, so a shortcut can
 * never be turned into an open redirect or a link to someone else's page.
 */

import { SITE_URL } from "./qr";

export type ShortcutTarget = { url: string; suggestedName: string };

type Client = {
  from: (table: string) => any;
};

/**
 * Resolve the signed-in owner's own storefront URL. Requires an approved
 * seller application with a brand slug — matching the same source of truth
 * getCreatorPublicCard uses for /store/$slug links elsewhere.
 */
export async function resolveOwnStorefrontTarget(
  supabase: Client,
  userId: string,
): Promise<ShortcutTarget> {
  const { data } = await supabase
    .from("seller_applications")
    .select("brand_name, brand_slug")
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();

  const slug = (data as any)?.brand_slug as string | null | undefined;
  if (!slug) {
    throw new Error(
      "Your storefront isn't ready yet. Finish setting up your storefront, then create this QR code.",
    );
  }
  const brand = ((data as any)?.brand_name as string | null) ?? "My storefront";
  return { url: `${SITE_URL}/store/${slug}`, suggestedName: brand.slice(0, 80) };
}

/**
 * Resolve one of the owner's OWN products. The product must belong to the
 * caller and be publicly reachable — otherwise the QR would print a link
 * that 404s (or, worse, point at a product the caller doesn't own).
 */
export async function resolveOwnProductTarget(
  supabase: Client,
  userId: string,
  productId: string,
): Promise<ShortcutTarget> {
  const { data } = await supabase
    .from("marketplace_products")
    .select("id, title, seller_id, published, status")
    .eq("id", productId)
    .eq("seller_id", userId)
    .maybeSingle();

  if (!data) throw new Error("Product not found in your catalog.");
  if (!(data as any).published || (data as any).status !== "approved") {
    throw new Error("That product isn't live yet. Publish it first, then create its QR code.");
  }
  const title = ((data as any).title as string | null) ?? "My product";
  return { url: `${SITE_URL}/products/${productId}`, suggestedName: title.slice(0, 80) };
}

/** The owner's live products, for the shortcut picker. */
export async function listOwnLiveProducts(
  supabase: Client,
  userId: string,
): Promise<{ id: string; title: string }[]> {
  const { data } = await supabase
    .from("marketplace_products")
    .select("id, title")
    .eq("seller_id", userId)
    .eq("published", true)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as any[]).map((p) => ({ id: p.id as string, title: (p.title ?? "") as string }));
}
