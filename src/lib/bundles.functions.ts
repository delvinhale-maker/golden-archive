import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  type Bundle,
  type BundleItem,
  computeBundleTotals,
  slugifyBundleName,
} from "@/lib/bundles";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const BUNDLE_COLS =
  "id,slug,name,short_description,full_description,image_url,price_cents,featured,status,start_at,end_at";

type RawBundle = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  full_description: string | null;
  image_url: string | null;
  price_cents: number;
  featured: boolean;
  status: string;
  start_at: string | null;
  end_at: string | null;
};

async function hydrate(sb: any, rows: RawBundle[]): Promise<Bundle[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { data: itemRows } = await sb
    .from("marketplace_bundle_items")
    .select("bundle_id,product_id,position,required")
    .in("bundle_id", ids)
    .order("position", { ascending: true });
  const items = (itemRows ?? []) as {
    bundle_id: string;
    product_id: string;
    position: number;
    required: boolean;
  }[];

  const productIds = Array.from(new Set(items.map((i) => i.product_id)));
  const { data: prodRows } = productIds.length
    ? await sb
        .from("marketplace_products")
        .select("id,title,slug,category,price_cents,cover_url,status,published")
        .in("id", productIds)
    : { data: [] };
  const byProduct = new Map(
    ((prodRows ?? []) as any[])
      .filter((p) => p.status === "approved" && p.published)
      .map((p) => [p.id, p]),
  );

  return rows.map((r) => {
    const bundleItems: BundleItem[] = items
      .filter((i) => i.bundle_id === r.id && byProduct.has(i.product_id))
      .map((i) => {
        const p = byProduct.get(i.product_id)!;
        return {
          productId: p.id,
          title: p.title,
          slug: p.slug ?? null,
          category: String(p.category),
          priceCents: p.price_cents,
          coverUrl: p.cover_url ?? null,
          position: i.position,
          required: i.required,
        };
      })
      .sort((a, b) => a.position - b.position);

    const totals = computeBundleTotals(
      r.price_cents,
      bundleItems.map((i) => i.priceCents),
    );

    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      shortDescription: r.short_description,
      fullDescription: r.full_description,
      imageUrl: r.image_url,
      priceCents: r.price_cents,
      featured: r.featured,
      status: r.status as Bundle["status"],
      startAt: r.start_at,
      endAt: r.end_at,
      items: bundleItems,
      ...totals,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Public reads (RLS already limits these to active, in-window rows)  *
 * ------------------------------------------------------------------ */

export const listActiveBundles = createServerFn({ method: "GET" }).handler(
  async (): Promise<Bundle[]> => {
    try {
      const sb = publicClient() as any;
      const { data } = await sb
        .from("marketplace_bundles")
        .select(BUNDLE_COLS)
        .eq("status", "active")
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(48);
      const bundles = await hydrate(sb, (data ?? []) as RawBundle[]);
      // A bundle with fewer than 2 purchasable members is not a bundle.
      return bundles.filter((b) => b.items.length >= 2);
    } catch (e) {
      console.error("[listActiveBundles] failed", e);
      return [];
    }
  },
);

export const getBundleBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => {
    if (!input.slug || input.slug.length > 120) throw new Error("Invalid slug");
    return { slug: input.slug };
  })
  .handler(async ({ data }): Promise<Bundle | null> => {
    try {
      const sb = publicClient() as any;
      const { data: row } = await sb
        .from("marketplace_bundles")
        .select(BUNDLE_COLS)
        .eq("slug", data.slug)
        .eq("status", "active")
        .maybeSingle();
      if (!row) return null;
      const [bundle] = await hydrate(sb, [row as RawBundle]);
      return bundle && bundle.items.length >= 2 ? bundle : null;
    } catch (e) {
      console.error("[getBundleBySlug] failed", e);
      return null;
    }
  });

/** Bundles that contain a given product — powers the PDP "Bundle & Save" module. */
export const getBundlesForProduct = createServerFn({ method: "GET" })
  .inputValidator((input: { productId: string }) => {
    if (!UUID_RE.test(input.productId)) throw new Error("Invalid productId");
    return input;
  })
  .handler(async ({ data }): Promise<Bundle[]> => {
    try {
      const sb = publicClient() as any;
      const { data: links } = await sb
        .from("marketplace_bundle_items")
        .select("bundle_id")
        .eq("product_id", data.productId);
      const ids = Array.from(
        new Set(((links ?? []) as { bundle_id: string }[]).map((l) => l.bundle_id)),
      );
      if (!ids.length) return [];
      const { data: rows } = await sb
        .from("marketplace_bundles")
        .select(BUNDLE_COLS)
        .in("id", ids)
        .eq("status", "active")
        .limit(6);
      const bundles = await hydrate(sb, (rows ?? []) as RawBundle[]);
      return bundles.filter((b) => b.items.length >= 2);
    } catch (e) {
      console.error("[getBundlesForProduct] failed", e);
      return [];
    }
  });

export type RecommendedEntry =
  | { kind: "product"; product: BundleItem }
  | { kind: "bundle"; bundle: Bundle };

/**
 * Admin-curated recommendations for a product. Falls back to same-category
 * products when nothing is curated, so the module is never empty on a page
 * that has siblings.
 */
export const getProductRecommendations = createServerFn({ method: "GET" })
  .inputValidator((input: { productId: string; kind?: string }) => {
    if (!UUID_RE.test(input.productId)) throw new Error("Invalid productId");
    return { productId: input.productId, kind: input.kind ?? "toolkit" };
  })
  .handler(async ({ data }): Promise<RecommendedEntry[]> => {
    try {
      const sb = publicClient() as any;
      const { data: recs } = await sb
        .from("product_recommendations")
        .select("recommended_product_id,recommended_bundle_id,position")
        .eq("product_id", data.productId)
        .eq("kind", data.kind)
        .eq("active", true)
        .order("position", { ascending: true })
        .limit(8);

      const rows = (recs ?? []) as {
        recommended_product_id: string | null;
        recommended_bundle_id: string | null;
      }[];

      const out: RecommendedEntry[] = [];

      const productIds = rows
        .map((r) => r.recommended_product_id)
        .filter((v): v is string => !!v);
      if (productIds.length) {
        const { data: prods } = await sb
          .from("marketplace_products")
          .select("id,title,slug,category,price_cents,cover_url,status,published")
          .in("id", productIds);
        for (const p of ((prods ?? []) as any[]).filter(
          (p) => p.status === "approved" && p.published,
        )) {
          out.push({
            kind: "product",
            product: {
              productId: p.id,
              title: p.title,
              slug: p.slug ?? null,
              category: String(p.category),
              priceCents: p.price_cents,
              coverUrl: p.cover_url ?? null,
              position: 0,
              required: false,
            },
          });
        }
      }

      const bundleIds = rows
        .map((r) => r.recommended_bundle_id)
        .filter((v): v is string => !!v);
      if (bundleIds.length) {
        const { data: brows } = await sb
          .from("marketplace_bundles")
          .select(BUNDLE_COLS)
          .in("id", bundleIds)
          .eq("status", "active");
        const bundles = await hydrate(sb, (brows ?? []) as RawBundle[]);
        for (const b of bundles.filter((b) => b.items.length >= 2)) {
          out.push({ kind: "bundle", bundle: b });
        }
      }

      if (out.length) return out;

      // Category fallback — same department, cheapest-first, excluding self.
      const { data: self } = await sb
        .from("marketplace_products")
        .select("category")
        .eq("id", data.productId)
        .maybeSingle();
      if (!self) return [];
      const { data: siblings } = await sb
        .from("marketplace_products")
        .select("id,title,slug,category,price_cents,cover_url")
        .eq("category", self.category)
        .eq("status", "approved")
        .eq("published", true)
        .neq("id", data.productId)
        .limit(4);
      return ((siblings ?? []) as any[]).map((p) => ({
        kind: "product" as const,
        product: {
          productId: p.id,
          title: p.title,
          slug: p.slug ?? null,
          category: String(p.category),
          priceCents: p.price_cents,
          coverUrl: p.cover_url ?? null,
          position: 0,
          required: false,
        },
      }));
    } catch (e) {
      console.error("[getProductRecommendations] failed", e);
      return [];
    }
  });

/** Fire-and-forget merchandising analytics. Never throws to the caller. */
export const logMerchEvent = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      kind: "impression" | "click" | "add_to_cart" | "upgrade" | "purchase";
      surface: string;
      bundleId?: string;
      productId?: string;
      sessionId?: string;
      offerVersion?: string;
      amountCents?: number;
    }) => {
      const kinds = ["impression", "click", "add_to_cart", "upgrade", "purchase"];
      if (!kinds.includes(input.kind)) throw new Error("Invalid kind");
      if (!input.surface || input.surface.length > 40) throw new Error("Invalid surface");
      if (input.bundleId && !UUID_RE.test(input.bundleId)) throw new Error("Invalid bundleId");
      if (input.productId && !UUID_RE.test(input.productId)) throw new Error("Invalid productId");
      return input;
    },
  )
  .handler(async ({ data }) => {
    try {
      const sb = publicClient() as any;
      await sb.from("merch_events").insert({
        kind: data.kind,
        surface: data.surface,
        bundle_id: data.bundleId ?? null,
        product_id: data.productId ?? null,
        session_id: data.sessionId ?? null,
        offer_version: data.offerVersion ?? null,
        amount_cents: data.amountCents ?? null,
      });
    } catch (e) {
      console.warn("[logMerchEvent] failed", e);
    }
    return { ok: true };
  });

/* ---------------------------- Admin ---------------------------- */

async function assertAdmin(context: any) {
  const { data: role } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Forbidden");
}

export type AdminBundle = Bundle & {
  views: number;
  clicks: number;
  addToCart: number;
  purchases: number;
  revenueCents: number;
};

export const adminListBundles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminBundle[]> => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data: rows } = await sb
      .from("marketplace_bundles")
      .select(BUNDLE_COLS)
      .order("created_at", { ascending: false })
      .limit(200);
    const bundles = await hydrate(sb, (rows ?? []) as RawBundle[]);

    const { data: events } = await sb
      .from("merch_events")
      .select("bundle_id,kind")
      .not("bundle_id", "is", null)
      .limit(20000);
    const { data: lines } = await sb
      .from("order_items")
      .select("bundle_id,unit_amount_cents,order_id")
      .not("bundle_id", "is", null)
      .limit(20000);

    return bundles.map((b) => {
      const evs = ((events ?? []) as any[]).filter((e) => e.bundle_id === b.id);
      const ls = ((lines ?? []) as any[]).filter((l) => l.bundle_id === b.id);
      const orderIds = new Set(ls.map((l) => l.order_id));
      return {
        ...b,
        views: evs.filter((e) => e.kind === "impression").length,
        clicks: evs.filter((e) => e.kind === "click").length,
        addToCart: evs.filter((e) => e.kind === "add_to_cart").length,
        purchases: orderIds.size,
        revenueCents: ls.reduce((n, l) => n + Number(l.unit_amount_cents ?? 0), 0),
      };
    });
  });

export const adminSaveBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      name: string;
      slug?: string;
      shortDescription?: string;
      fullDescription?: string;
      imageUrl?: string;
      priceCents: number;
      status: "draft" | "active" | "archived";
      featured?: boolean;
      startAt?: string | null;
      endAt?: string | null;
      productIds: string[];
    }) => {
      if (!input.name || input.name.trim().length < 3) throw new Error("Name is required");
      if (!Number.isInteger(input.priceCents) || input.priceCents < 100) {
        throw new Error("Price must be at least $1.00");
      }
      if (!Array.isArray(input.productIds) || input.productIds.length < 2) {
        throw new Error("A bundle needs at least 2 products");
      }
      if (input.productIds.length > 20) throw new Error("Too many products");
      for (const id of input.productIds) {
        if (!UUID_RE.test(id)) throw new Error("Invalid productId");
      }
      if (!["draft", "active", "archived"].includes(input.status)) {
        throw new Error("Invalid status");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;

    const productIds = Array.from(new Set(data.productIds));
    const { data: prods, error: prodErr } = await sb
      .from("marketplace_products")
      .select("id,seller_id,status,published,price_cents")
      .in("id", productIds);
    if (prodErr) throw new Error(prodErr.message);
    const rows = (prods ?? []) as any[];
    if (rows.length !== productIds.length) {
      throw new Error("One or more products no longer exist");
    }
    const unavailable = rows.filter((p) => p.status !== "approved" || !p.published);
    if (unavailable.length) {
      throw new Error("Every bundled product must be approved and published");
    }
    // Mixed-creator bundles are blocked: cross-creator discount allocation is
    // not authorized by the creator agreement yet.
    const sellers = Array.from(new Set(rows.map((p) => p.seller_id)));
    if (sellers.length > 1) {
      throw new Error(
        "Mixed-creator bundles are not supported yet — every product must belong to the same creator",
      );
    }
    const ownerSellerId = sellers[0];

    const slug = slugifyBundleName(data.slug?.trim() || data.name);
    if (!slug) throw new Error("Could not build a web address from that name");

    const payload = {
      owner_seller_id: ownerSellerId,
      name: data.name.trim(),
      slug,
      short_description: data.shortDescription?.trim() || null,
      full_description: data.fullDescription?.trim() || null,
      image_url: data.imageUrl?.trim() || null,
      price_cents: data.priceCents,
      status: data.status,
      featured: !!data.featured,
      start_at: data.startAt || null,
      end_at: data.endAt || null,
    };

    let bundleId = data.id;
    if (bundleId) {
      const { error } = await sb
        .from("marketplace_bundles")
        .update(payload)
        .eq("id", bundleId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await sb
        .from("marketplace_bundles")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      bundleId = created.id as string;
    }

    await sb.from("marketplace_bundle_items").delete().eq("bundle_id", bundleId);
    const { error: itemErr } = await sb.from("marketplace_bundle_items").insert(
      productIds.map((productId, i) => ({
        bundle_id: bundleId,
        product_id: productId,
        position: (i + 1) * 10,
        required: true,
      })),
    );
    if (itemErr) throw new Error(itemErr.message);

    const totals = computeBundleTotals(
      data.priceCents,
      productIds.map((id) => rows.find((p) => p.id === id)!.price_cents),
    );

    return { id: bundleId, slug, ...totals };
  });

export const adminDeleteBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!UUID_RE.test(input.id)) throw new Error("Invalid id");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("marketplace_bundles")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Products an admin can pick from when building a bundle. */
export const adminBundleCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await (context.supabase as any)
      .from("marketplace_products")
      .select("id,title,category,subcategory,price_cents,cover_url")
      .eq("status", "approved")
      .eq("published", true)
      .order("title", { ascending: true })
      .limit(500);
    return ((data ?? []) as any[]).map((p) => ({
      id: p.id,
      title: p.title,
      category: String(p.category),
      subcategory: p.subcategory ?? null,
      priceCents: p.price_cents,
      coverUrl: p.cover_url ?? null,
    }));
  });
