/**
 * AurumVault QR Business System — Phase 2 native AurumVault shortcuts.
 *
 * These two functions do exactly one thing: derive a canonical, public,
 * eligible AurumVault URL for the authenticated caller's own storefront or
 * product, entirely server-side. They never create a qr_project — the
 * client takes the returned destination and feeds it into the existing
 * createQrProject flow (qr.functions.ts), which independently re-validates
 * it as an https URL before ever persisting anything. That means a bug here
 * can, at worst, return a URL createQrProject then rejects — it can never
 * itself write an unvalidated destination.
 *
 * Ownership is always re-derived from context.userId; a client-supplied
 * slug or product id is used only as a lookup key, never as proof of whose
 * it is. Per the Phase 2 authorization, a creator-bundle shortcut is
 * explicitly NOT implemented here — see the Phase 2 report.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SITE_URL } from "@/lib/qr";

export type QrShortcutDestination = {
  destination: string;
  suggestedName: string;
};

/**
 * "Create QR for My Store" (Phase 2 Section 15). Mirrors
 * saveMyStorefrontProfile's pattern exactly: seller_applications has no
 * owner-scoped RLS SELECT for this shape of lookup, so the caller's own row
 * is read via supabaseAdmin (service-role) scoped strictly by
 * context.userId — never by a client-supplied identifier.
 */
export const createStorefrontQrShortcut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QrShortcutDestination> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app } = await supabaseAdmin
      .from("seller_applications")
      .select("status, brand_slug, brand_name")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!app || (app as any).status !== "approved") {
      throw new Error("Your storefront isn't approved yet.");
    }
    const brandSlug = (app as any).brand_slug as string | null;
    if (!brandSlug) {
      throw new Error("Set up your storefront address before creating a QR code for it.");
    }

    return {
      destination: `${SITE_URL}/store/${brandSlug}`,
      suggestedName: (app as any).brand_name ? `${(app as any).brand_name} Store` : "My Store",
    };
  });

/**
 * "Create QR for This Product" (Phase 2 Section 16). Uses the RLS-bound
 * context.supabase client, scoped by seller_id = context.userId — the same
 * pattern saveMyStorefrontSettings uses to verify owned product ids.
 * Rejects another seller's product, and rejects an owned product that
 * isn't public-linkable yet (not approved / not published) rather than
 * generating a QR that points at a page visitors can't actually see.
 */
export const createProductQrShortcut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ productId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<QrShortcutDestination> => {
    const { supabase, userId } = context;
    const { data: product, error } = await supabase
      .from("marketplace_products")
      .select("id, title, seller_id, status, published")
      .eq("id", data.productId)
      .eq("seller_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) throw new Error("Product not found.");
    if ((product as any).status !== "approved" || !(product as any).published) {
      throw new Error("This product isn't public yet — approve and publish it first.");
    }

    return {
      destination: `${SITE_URL}/products/${(product as any).id}`,
      suggestedName: (product as any).title ? String((product as any).title) : "My Product",
    };
  });

export type MyEligibleProduct = { id: string; title: string };

/**
 * Feeds the "Create QR for This Product" picker in the Creator Industry
 * Kit — only the caller's own approved-and-published products, so nothing
 * shown here could fail createProductQrShortcut's own eligibility check.
 */
export const listMyEligibleProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyEligibleProduct[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("marketplace_products")
      .select("id, title")
      .eq("seller_id", userId)
      .eq("status", "approved")
      .eq("published", true)
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as MyEligibleProduct[];
  });
