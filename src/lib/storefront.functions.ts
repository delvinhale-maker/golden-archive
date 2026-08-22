import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_ACCENT,
  MAX_FEATURED_PRODUCTS,
  STOREFRONT_ACCENTS,
  filterOwnedProductIds,
  normalizeAccent,
  safeExternalUrl,
  splitGross,
} from "@/lib/storefront";
import type {
  CreatorPublicCard,
  MoreFromCreatorProduct,
  StorefrontAnalytics,
  StorefrontSettings,
} from "@/lib/storefront-types";

const uuid = z.string().uuid();

/** Public: merchandising settings that drive the public storefront. */
export const getStorefrontSettings = createServerFn({ method: "GET" })
  .inputValidator((input: { userId: string }) => z.object({ userId: uuid }).parse(input))
  .handler(async ({ data }): Promise<StorefrontSettings> => {
    const { publicClient } = await import("@/lib/founding-public.server");
    const { data: row } = await publicClient()
      .from("creator_storefront_settings")
      .select("headline, logo_url, accent, featured_product_ids, featured_bundle_id")
      .eq("user_id", data.userId)
      .maybeSingle();
    return {
      headline: (row?.headline as string | null) ?? null,
      logoUrl: safeExternalUrl(row?.logo_url as string | null) ?? (row?.logo_url as string | null) ?? null,
      accent: normalizeAccent(row?.accent as string | null),
      featuredProductIds: (row?.featured_product_ids as string[] | null) ?? [],
      featuredBundleId: (row?.featured_bundle_id as string | null) ?? null,
    };
  });

/** The signed-in creator's own settings (creates nothing; empty defaults are fine). */
export const getMyStorefrontSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StorefrontSettings> => {
    const { data: row } = await context.supabase
      .from("creator_storefront_settings")
      .select("headline, logo_url, accent, featured_product_ids, featured_bundle_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      headline: (row?.headline as string | null) ?? null,
      logoUrl: (row?.logo_url as string | null) ?? null,
      accent: normalizeAccent(row?.accent as string | null),
      featuredProductIds: (row?.featured_product_ids as string[] | null) ?? [],
      featuredBundleId: (row?.featured_bundle_id as string | null) ?? null,
    };
  });

/**
 * Save storefront identity + merchandising. Ownership is re-derived server-side:
 * featured products must belong to the caller, and the bundle must be theirs.
 */
export const saveMyStorefrontSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        headline: z.string().max(90).nullable().optional(),
        logoUrl: z.string().max(400).nullable().optional(),
        accent: z.enum(STOREFRONT_ACCENTS).optional(),
        featuredProductIds: z.array(uuid).max(24).optional(),
        featuredBundleId: uuid.nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<StorefrontSettings> => {
    const { supabase, userId } = context;

    const { data: ownedProducts } = await supabase
      .from("marketplace_products")
      .select("id")
      .eq("seller_id", userId);
    const ownedIds = (ownedProducts ?? []).map((p) => p.id as string);
    const featured = filterOwnedProductIds(data.featuredProductIds ?? [], ownedIds);

    let featuredBundleId: string | null = null;
    if (data.featuredBundleId) {
      const { data: bundle } = await (supabase.from("creator_bundles" as never) as any)
        .select("id")
        .eq("id", data.featuredBundleId)
        .eq("seller_id", userId)
        .maybeSingle();
      featuredBundleId = bundle ? data.featuredBundleId : null;
    }

    const headline = data.headline?.trim() ? data.headline.trim().slice(0, 90) : null;
    const logoUrl = safeExternalUrl(data.logoUrl ?? null);

    const payload = {
      user_id: userId,
      headline,
      logo_url: logoUrl,
      accent: data.accent ?? DEFAULT_ACCENT,
      featured_product_ids: featured,
      featured_bundle_id: featuredBundleId,
    };

    const { error } = await (supabase.from("creator_storefront_settings") as any).upsert(payload, {
      onConflict: "user_id",
    });
    if (error) throw new Error(error.message);

    return {
      headline,
      logoUrl,
      accent: normalizeAccent(payload.accent),
      featuredProductIds: featured,
      featuredBundleId,
    };
  });

/**
 * Public, fire-and-forget attribution ping. Stores no visitor identifiers —
 * only which creator surface was seen and which campaign referred it.
 */
export const logStorefrontEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        creatorUserId: uuid,
        kind: z.enum(["storefront_view", "product_click", "share", "qr"]),
        productId: uuid.nullable().optional(),
        utmSource: z.string().max(80).nullable().optional(),
        utmMedium: z.string().max(80).nullable().optional(),
        utmCampaign: z.string().max(120).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { publicClient } = await import("@/lib/founding-public.server");
    const { error } = await publicClient()
      .from("creator_storefront_events")
      .insert({
        creator_user_id: data.creatorUserId,
        kind: data.kind,
        product_id: data.productId ?? null,
        utm_source: data.utmSource ?? null,
        utm_medium: data.utmMedium ?? null,
        utm_campaign: data.utmCampaign ?? null,
      });
    // Analytics must never break a page render.
    return { ok: !error };
  });

/** Public creator card for product pages: storefront link + real product count. */
export const getCreatorPublicCard = createServerFn({ method: "GET" })
  .inputValidator((input: { sellerId: string }) => z.object({ sellerId: uuid }).parse(input))
  .handler(async ({ data }): Promise<CreatorPublicCard | null> => {
    const { publicClient } = await import("@/lib/founding-public.server");
    const client = publicClient();

    const { data: app } = await client
      .from("seller_applications")
      .select("brand_name, brand_slug, pitch, website, user_id")
      .eq("user_id", data.sellerId)
      .eq("status", "approved")
      .maybeSingle();
    if (!app) return null;

    const [{ data: profile }, { count }, { data: founding }, { data: settings }] = await Promise.all([
      client.from("profiles").select("display_name, avatar_url").eq("id", data.sellerId).maybeSingle(),
      client
        .from("marketplace_products")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", data.sellerId)
        .eq("status", "approved")
        .eq("published", true),
      client
        .from("founding_creators")
        .select("founding_number")
        .eq("user_id", data.sellerId)
        .maybeSingle(),
      client
        .from("creator_storefront_settings")
        .select("headline, accent")
        .eq("user_id", data.sellerId)
        .maybeSingle(),
    ]);

    return {
      sellerId: data.sellerId,
      brandName: (app as any).brand_name as string,
      brandSlug: (app as any).brand_slug as string | null,
      headline: (settings?.headline as string | null) ?? null,
      accent: normalizeAccent(settings?.accent as string | null),
      pitch: ((app as any).pitch as string | null) ?? null,
      website: safeExternalUrl((app as any).website as string | null),
      displayName: (profile?.display_name as string | null) ?? null,
      avatarUrl: (profile?.avatar_url as string | null) ?? null,
      foundingNumber: (founding?.founding_number as number | undefined) ?? null,
      productCount: count ?? 0,
    };
  });

/** Public: other live products from the same creator. */
export const getMoreFromCreator = createServerFn({ method: "GET" })
  .inputValidator((input: { sellerId: string; excludeProductId?: string }) =>
    z.object({ sellerId: uuid, excludeProductId: uuid.optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<MoreFromCreatorProduct[]> => {
    const { publicClient } = await import("@/lib/founding-public.server");
    let query = publicClient()
      .from("marketplace_products")
      .select("id, slug, title, cover_url, price_cents, compare_at_price_cents, category")
      .eq("seller_id", data.sellerId)
      .eq("status", "approved")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(8);
    if (data.excludeProductId) query = query.neq("id", data.excludeProductId);
    const { data: rows } = await query;
    return (rows ?? []) as MoreFromCreatorProduct[];
  });

/**
 * The signed-in creator's own storefront analytics. The creator identity comes
 * from the bearer token only — never from client input — so one creator can
 * never read another's numbers.
 */
export const getMyStorefrontAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<StorefrontAnalytics> => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: events }, { data: products }] = await Promise.all([
      supabase
        .from("creator_storefront_events")
        .select("kind, product_id, utm_source, created_at")
        .eq("creator_user_id", userId)
        .gte("created_at", since)
        .limit(20000),
      supabase
        .from("marketplace_products")
        .select("id, title")
        .eq("seller_id", userId),
    ]);

    const titles = new Map<string, string>(
      (products ?? []).map((p) => [p.id as string, p.title as string]),
    );
    const productIds = [...titles.keys()];

    const { data: items } = productIds.length
      ? await supabase
          .from("order_items")
          .select("product_id, quantity, unit_price_cents, order_id, created_at")
          .in("product_id", productIds)
          .gte("created_at", since)
          .limit(20000)
      : { data: [] as any[] };

    let grossCents = 0;
    let units = 0;
    const orderIds = new Set<string>();
    const perProduct = new Map<string, { units: number; grossCents: number }>();

    for (const row of (items ?? []) as any[]) {
      const qty = Number(row.quantity ?? 1) || 1;
      const gross = Number(row.unit_price_cents ?? 0) * qty;
      grossCents += gross;
      units += qty;
      if (row.order_id) orderIds.add(row.order_id as string);
      const entry = perProduct.get(row.product_id as string) ?? { units: 0, grossCents: 0 };
      entry.units += qty;
      entry.grossCents += gross;
      perProduct.set(row.product_id as string, entry);
    }

    let storefrontViews = 0;
    let productClicks = 0;
    let shares = 0;
    const sources = new Map<string, number>();

    for (const e of (events ?? []) as any[]) {
      if (e.kind === "storefront_view") storefrontViews += 1;
      else if (e.kind === "product_click") productClicks += 1;
      else shares += 1;
      if (e.kind === "storefront_view") {
        const key = (e.utm_source as string | null)?.trim() || "direct";
        sources.set(key, (sources.get(key) ?? 0) + 1);
      }
    }

    const money = splitGross(grossCents);

    return {
      rangeDays: data.days,
      storefrontViews,
      productClicks,
      shares,
      orders: orderIds.size,
      units,
      ...money,
      topProducts: [...perProduct.entries()]
        .map(([id, v]) => ({
          productId: id,
          title: titles.get(id) ?? "Untitled",
          units: v.units,
          grossCents: v.grossCents,
          creatorEarningsCents: splitGross(v.grossCents).creatorEarningsCents,
        }))
        .sort((a, b) => b.grossCents - a.grossCents)
        .slice(0, 8),
      trafficSources: [...sources.entries()]
        .map(([source, views]) => ({ source, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 8),
    };
  });

/**
 * Admin moderation: clear creator-authored storefront identity fields that
 * violate policy. Admin role is verified server-side before writing.
 */
export const adminModerateStorefront = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: uuid,
        clearHeadline: z.boolean().default(false),
        clearLogo: z.boolean().default(false),
        clearFeatured: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const patch: Record<string, unknown> = {};
    if (data.clearHeadline) patch.headline = null;
    if (data.clearLogo) patch.logo_url = null;
    if (data.clearFeatured) patch.featured_product_ids = [];
    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await (context.supabase.from("creator_storefront_settings") as any)
      .update(patch)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export { MAX_FEATURED_PRODUCTS };
